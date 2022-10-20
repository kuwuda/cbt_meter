package main

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"time"
)

const (
	pongWait   = 5 * time.Minute
	pingPeriod = (pongWait * 9) / 10
	writeWait  = 20 * time.Second
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Client struct {
	server *Server
	conn   *websocket.Conn
	send   chan []byte
	auth   bool
}

type PTE struct {
	Name string
	Turns int
	Id int
}

/* Used to validate message */
type Meter struct {
	Name    string
	Gain    int
	Current int
	PTE     []PTE
	PTEIdPool []int
	Id      int
	Visible bool
}

type TurnMeter struct {
	Max     int
	Current int
}

type mContainer struct {
	DataPool  []Meter
	IdPool    []int
	TurnMeter TurnMeter
}

func parseData(in []byte, auth bool) (out []byte, err error) {
	var data mContainer
	err = json.Unmarshal(in, &data)
	if err != nil {
		return
	}

	/* Copy data into new container to remove invisible from normal array */
	var tempCont mContainer
	for i, n := range data.DataPool {
		if n.Visible || auth {
			tempCont.DataPool = append(tempCont.DataPool, data.DataPool[i])
		}
	}
	tempCont.IdPool = data.IdPool
	tempCont.TurnMeter = data.TurnMeter
	out, err = json.Marshal(tempCont)
	return
}

var tmRunning bool

/* Reads incoming data from websocket to server */
func (c *Client) readPump() {
	defer func() {
		c.server.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		if c.auth != true {
			return
		}
		/* validates as json */
		var data mContainer
		err = json.Unmarshal(message, &data)

		if err != nil {
			/* Lazy error handling for now */
			log.Printf("%s", err)
			return
		}

		if data.TurnMeter.Current > 0 && tmRunning == false {
			ticker := time.NewTicker(time.Second)
			quit := make(chan struct{})
			go func() {
				for {
					select {
					case <-ticker.C:
						tmRunning = true
						if data.TurnMeter.Current > 0 {
							data.TurnMeter.Current--
						}
						if data.TurnMeter.Current <= 0 {
							tmRunning = false
							close(quit)
						}
						message, err = json.Marshal(data)
						err = redisClient.Set("data", message, 0).Err()
						if err != nil {
							log.Printf("%s", err)
							return
						}
						c.server.broadcast <- message
					case <-quit:
						ticker.Stop()
						return
					}
				}
			}()
		}

		err = redisClient.Set("data", message, 0).Err()
		if err != nil {
			log.Printf("%s", err)
			return
		}
		c.server.broadcast <- message
	}
}

/* Sends data from the server to the websocket */
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				/* Server closed channel */
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			message, err = parseData(message, c.auth)
			if err != nil {
				log.Printf("%s", err)
				return
			}

			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func serveWs(server *Server, w http.ResponseWriter, r *http.Request) {
	logged, _ := validateLogin(r)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	client := &Client{server: server, conn: conn, send: make(chan []byte, 256), auth: logged}
	client.server.register <- client

	go client.writePump()
	go client.readPump()
}
