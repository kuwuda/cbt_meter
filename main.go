package main

import (
	"encoding/json"
	"flag"
	"github.com/go-redis/cache"
	"github.com/go-redis/redis"
	"github.com/satori/go.uuid"
	"html/template"
	"log"
	"net/http"
	"time"
)

var addr = flag.String("addr", ":8080", "http service address")

var indexTemplate = template.Must(template.ParseFiles("index.html"))

var redisClient = redis.NewClient(&redis.Options{
	Addr:     "localhost:6379",
	Password: "",
	DB:       0,
})

var codec = &cache.Codec{
	Redis: redisClient,
	Marshal: func(v interface{}) ([]byte, error) {
		return json.Marshal(v)
	},
	Unmarshal: func(b []byte, v interface{}) error {
		return json.Unmarshal(b, v)
	},
}

type Account struct {
	Password string `json:"password"`
	Username string `json:"username"`
}

func login(w http.ResponseWriter, r *http.Request) {
	var info Account
	err := json.NewDecoder(r.Body).Decode(&info)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	expectedPassword, err := redisClient.Get(info.Username).Result()
	if err != nil || expectedPassword != info.Password {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	u, err := uuid.NewV4()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	sessionToken := u.String()

	codec.Set(&cache.Item{
		Key:        sessionToken,
		Object:     info.Username,
		Expiration: time.Hour,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    sessionToken,
		Expires:  time.Now().Add(time.Hour),
		HttpOnly: true,
	})

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func logout(w http.ResponseWriter, r *http.Request) {
	logged, err := validateLogin(r)
	if err != nil || !logged {
		log.Printf("%s", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	c, _ := r.Cookie("session_token")
	sessionToken := c.Value
	var response string
	_ = codec.Get(sessionToken, &response)

	codec.Set(&cache.Item{
		Key:        sessionToken,
		Expiration: 0,
	})

	http.SetCookie(w, &http.Cookie{
		Name:   "session_token",
		Value:  "",
		MaxAge: -1,
	})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func validateLogin(r *http.Request) (bool, error) {
	c, err := r.Cookie("session_token")
	if err != nil {
		if err != http.ErrNoCookie {
			return false, err
		} else {
			return false, http.ErrNoCookie
		}
	}
	sessionToken := c.Value

	var response string
	err = codec.Get(sessionToken, &response)
	if err != nil {
		return false, err
	}
	if response == "" {
		return false, nil
	}
	return true, nil
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
	logged, err := validateLogin(r)
	if err != nil || !logged {
		err = indexTemplate.Execute(w, false)
		return
	}

	err = indexTemplate.Execute(w, true)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func main() {
	flag.Parse()
	server := newServer()
	go server.run()
	fs := http.FileServer(http.Dir("static/"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/login", login)
	http.HandleFunc("/logout", logout)
	http.HandleFunc("/", indexHandler)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(server, w, r)
	})
	log.Fatal(http.ListenAndServe(*addr, nil))
}
