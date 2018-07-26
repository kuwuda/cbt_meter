/* 
 * Will be a global multi-dimensional array
 * This is the most convenient appraoch for this case
 * Values are: name, ap gain, current ap, id
 */
var paused = true;
/* Array set-up is: Name, AP Gain, Current AP, ID */ 
var dataPool = [];
var idPool = [];

var socket = new WebSocket("ws://" + document.location.host + "/ws");
socket.onerror = function(error) {
	console.log("WebSocket Error: " + error);
};
socket.onmessage = function(event) {
	var received = JSON.parse(event.data);
	dataPool = received.dataPool;
	idPool   = received.idPool;
	drawGrid();
}

function compareAllVals(a,b) {
	if (a.Current < b.Current)
		return 1;
	if (a.Current > b.Current)
		return -1;
	return 0;
}
function sendToBackend() {
	var sent = {dataPool: dataPool, idPool: idPool};
	socket.send(JSON.stringify(sent));
}
function getCurrentTable(visible) {
        if (visible == true) {
                return document.getElementById("visible");
        } else {
                return document.getElementById("invisible");
        }
}
function drawGrid() {
        visible = document.getElementById("visible");
        /* Removes all elements from #visible aside from the header */
        while (visible.childNodes.length > 2) {
                visible.removeChild(visible.lastChild);
        }
	dataPool.sort(compareAllVals);
        for (var i in dataPool) {
                appendList(dataPool[i], true);
        }
}
function timer() {
        while (!paused && dataPool.length != 0) {
                for (var i in dataPool) {
                        if (Number(dataPool[i].Current) >= 100) {
                                paused = true;
                        }
                        dataPool[i].Current += dataPool[i].Gain;
                }
		sendToBackend();
                drawGrid();
        }
}

function reset() {
        if (confirm("Are you sure you want to reset everything?")) {
                dataPool = [];
		sendToBackend()
                drawGrid();
        }
}
function deleteRow(currObj) {
	for (var i in dataPool) {
	        if (dataPool[i].Id == currObj.Id) {
	                dataPool.splice(i, 1);
			idPool.push(currObj.Id);
			idPool.sort(function(a,b){return b - a});
	        }
	}
	sendToBackend();
	drawGrid();
}
function rest(currObj) {
	for (var i in dataPool) {
	        if (dataPool[i].Id == currObj.Id) {
	                dataPool[i].Current = 25;
	        }
	}
	sendToBackend();
	drawGrid();
}
function zeroOut(currObj) {
	for (var i in dataPool) {
	        if (dataPool[i].Id == currObj.Id) {
	                dataPool[i].Current = 0;
	        }
	}
	sendToBackend();
	drawGrid();
}
function appendList(currObj, visible) {
        var name = currObj.Name;
        var gain = currObj.Gain;
        var curr = currObj.Current;
        /*
         * Feels weird creating so many variables just to discard them
         * I don't think there's a better method of doing this though.
         */
        var currentTable  = getCurrentTable(visible);
        var row_element   = document.createElement("tr");
        var meter_element = document.createElement("td");
        var name_element  = document.createElement("td");
        var gain_element  = document.createElement("td");
        var curr_element  = document.createElement("td");
        var opt_element   = document.createElement("td");

        var meter_fg = document.createElement("div");
        meter_fg.style.backgroundColor  = "green";
        if (curr >= 100) {
                meter_fg.style.width = "100%";
                meter_fg.style.backgroundColor = "purple";
        } else if (curr < 0) {
                meter_fg.style.width = "100%";
                meter_fg.style.backgroundColor = "red";
        } else {
                meter_fg.style.width = curr + "%";
        }
        meter_fg.style.height = "30px";
        meter_fg.style.color = "#f0f0f0";
        meter_fg.style.textAlign = "center";
        meter_fg.textContent = curr + "%";
        meter_element.style.backgroundColor = "grey";
        meter_element.appendChild(meter_fg);

        /* I feel like there's a better way to do this */
        var nameInput = document.createElement("input");
        nameInput.type  = "text";
        nameInput.name  = "name";
        nameInput.value = name;
        name_element.appendChild(nameInput);

        var gainInput = document.createElement("input");
        gainInput.type  = "text";
        gainInput.name  = "gain";
        gainInput.value = gain;
        gain_element.appendChild(gainInput);

        var currInput = document.createElement("input");
        currInput.type  = "text";
        currInput.name  = "curr";
        currInput.value = curr;
        curr_element.appendChild(currInput);

        var hiddInput = document.createElement("input");
        hiddInput.type  = "hidden";
        hiddInput.name  = "id";
        hiddInput.value = currObj.Id;
        opt_element.appendChild(hiddInput);

        var delete_button = document.createElement("input");
        delete_button.type    = "button";
        delete_button.name    = "delete";
        delete_button.value   = "Delete";
        delete_button.onclick = function(){deleteRow(currObj)};

        var zero_button = document.createElement("input");
        zero_button.type    = "button";
        zero_button.name    = "zero";
        zero_button.value   = "Zero Out Meter";
        zero_button.onclick = function(){zeroOut(currObj)};

        var rest_button = document.createElement("input");
        rest_button.type    = "button";
        rest_button.name    = "rest";
        rest_button.value   = "Rest";
        rest_button.onclick = function(){rest(currObj)};

        opt_element.appendChild(hiddInput);
        opt_element.appendChild(delete_button);
        opt_element.appendChild(zero_button);
        opt_element.appendChild(rest_button);

        
        row_element.appendChild(meter_element);
        row_element.appendChild(name_element);
        row_element.appendChild(gain_element);
        row_element.appendChild(curr_element);
        row_element.appendChild(opt_element);

        currentTable.appendChild(row_element);
}
$(document).ready(function() {
        $( "form" ).submit(function( event ) {
                /*
                 * Make sure to secure this against XSS attacks
                 * Probably just HTML / JS encode data before doing anything with it
		 *
		 * I could probably skip one of these steps
                 */
                var newList = $( this ).serializeArray();
                var arrayList = [];
                for (var i in newList) {
                        /* 
                         * Javascript is dynamically typed so it counts the form input value as a string
                         * Have to cast it to an int (where appropriate) so it doesn't do that.
                         */
                        if (i == 0 ) {
                                arrayList.push(newList[i].value);
                        } else {
                                arrayList.push(Number(newList[i].value));
                        }

                }
		if (idPool.length > 0) {
               		arrayList.push(idPool.pop());
		} else {
			arrayList.push(dataPool.length);
		}
		var tempObj = {Name: arrayList[0], Gain: arrayList[1], Current: arrayList[2], Id: arrayList[3]}
                dataPool.push(tempObj);
		sendToBackend();
                drawGrid();
                event.preventDefault();
        });

        /* automatically updates dataPool when an input in #visible changes */
        $("#visible").on("change", ":input", function () {
                var siblings = $(this).parent().parent().find("input");
                var id = siblings[3].value;
                for (var i in dataPool) {
                        if (dataPool[i].Id == id) {
                                dataPool[i].Name    = siblings[0].value;
                                dataPool[i].Gain    = Number(siblings[1].value);
                                dataPool[i].Current = Number(siblings[2].value);
                        }
                }
		sendToBackend();
                drawGrid();
        });
});
