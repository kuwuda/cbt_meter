package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
)

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
}

func serverResponseHandler(w http.ResponseWriter, r *http.Request) {
	payload := []Meter{}
	kusu := Meter{
		Name:    "Kusuda",
		Gain:    7,
		Current: 0,
		Id:      0,
		Visible: true,
	}
	ajoke := Meter{
		Name:    "Ajoke",
		Gain:    6,
		Current: 22,
		Id:      1,
		Visible: true,
	}
	sophia := Meter{
		Name:    "Sophia",
		Gain:    6,
		Current: -55,
		Id:      2,
		Visible: true,
	}
	payload = append(payload, kusu)
	payload = append(payload, ajoke)
	payload = append(payload, sophia)
	sent, _ := json.Marshal(payload)
	_, err := fmt.Fprint(w, string(sent))
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
	log.Fatal(http.ListenAndServe(":8080", nil))
}
