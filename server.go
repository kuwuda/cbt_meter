package main

import (
	"github.com/go-redis/redis"
	"log"
)

type Server struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func newServer() *Server {
	return &Server{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

func (s *Server) run() {
	for {
		select {
		case client := <-s.register:
			s.clients[client] = true
			str, err := redisClient.Get("data").Result()
			if err != nil {
				if err == redis.Nil {
					str = "{\"DataPool\": [], \"IdPool\": [], \"TurnMeter\": {}}"
					err = redisClient.Set("data", str, 0).Err()
					if err != nil {
						log.Printf("%s", err)
					}
				} else {
					log.Printf("%s", err)
				}
			}
			message := []byte(str)
			client.send <- message
		case client := <-s.unregister:
			if _, ok := s.clients[client]; ok {
				delete(s.clients, client)
				close(client.send)
			}
		case message := <-s.broadcast:
			for client := range s.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(s.clients, client)
				}
			}
		}
	}
}
