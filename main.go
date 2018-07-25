package main

import (
	"encoding/json"
	"fmt"
	"github.com/go-redis/redis"
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
)

var client = redis.NewClient(&redis.Options{
	Addr:     "localhost:6379",
	Password: "",
	DB:       0,
})

type Meter struct {
	Name    string
	Gain    int
	Current int
	Id      int
	Visible bool
}

var indexTemplate = template.Must(template.ParseFiles("index.html"))

func indexHandler(w http.ResponseWriter, r *http.Request) {
	err := indexTemplate.Execute(w, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func retrieveFromClientHandler(w http.ResponseWriter, r *http.Request) {
	b, err := ioutil.ReadAll(r.Body)
	defer r.Body.Close()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	data := make([]Meter, 0)
	err = json.Unmarshal(b, &data)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	err = client.Set("data", b, 0).Err()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
}

func serverResponseHandler(w http.ResponseWriter, r *http.Request) {
	str, err := client.Get("data").Result()
	if err != nil {
		http.Error(w, err.Error(), 500)
	}

	_, err := fmt.Fprint(w, str)
	if err != nil {
		http.Error(w, err.Error(), 500)
	}
}

func main() {
	fs := http.FileServer(http.Dir("static/"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/", indexHandler)
	http.HandleFunc("/updateClient/", serverResponseHandler)
	http.HandleFunc("/updateServer/", retrieveFromClientHandler)
	log.Fatal(http.ListenAndServe(":80", nil))
}
