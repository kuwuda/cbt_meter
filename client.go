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
}

/* Used to validate message */
type Meter struct {
	Name    string
	Gain    int
	Current int
	Id      int
	Visible bool
}

type mContainer struct {
	dataPool []Meter
	idPool   []string
}

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
		/* validates as json */
		var data mContainer
		err = json.Unmarshal(message, &data)
		if err != nil {
			/* Lazy error handling for now */
			log.Printf("%s", err)
		} else {
			err = redisClient.Set("data", message, 0).Err()
			if err != nil {
				log.Printf("%s", err)
				return
			}
			c.server.broadcast <- message
		}
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
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	client := &Client{server: server, conn: conn, send: make(chan []byte, 256)}
	client.server.register <- client

	go client.writePump()
	go client.readPump()
}
