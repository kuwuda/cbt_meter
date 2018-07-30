/* 
 * Will be a global multi-dimensional array
 * This is the most convenient appraoch for this case
 * Values are: name, ap gain, current ap, id
 */
var paused = true;
/* Array set-up is: Name, AP Gain, Current AP, ID, visible */ 
var DataPool = Array();
var IdPool = [];
var TurnMeter;

var socket = new WebSocket("ws://" + document.location.host + "/ws");
socket.onerror = function(error) {
	console.log("WebSocket Error: " + error);
};
socket.onmessage = function(event) {
	var received = JSON.parse(event.data);
	DataPool  = received.DataPool;
	if (DataPool == null)
		DataPool = Array();
	IdPool    = received.IdPool;
	TurnMeter = received.TurnMeter;
	drawGrid();
}
socket.onclose = function(event) {
	$("#statusBar").text("WebSocket connection closed! Please refresh the page.");
}

function compareAllVals(a,b) {
	if (a.Current < b.Current)
		return 1;
	if (a.Current > b.Current)
		return -1;
	return 0;
}
function sendToBackend() {
	var sent = {DataPool: DataPool, IdPool: IdPool, TurnMeter: TurnMeter};
	socket.send(JSON.stringify(sent));
	/* Refresh authentication */
	$.get("/refresh");
}
function getCurrentTable(visible) {
        if (visible == true) {
                return document.getElementById("visible");
        } else {
                return document.getElementById("invisible");
        }
}
function drawGrid() {
        visible   = document.getElementById("visible");
	invisible = document.getElementById("invisible");
        /* Removes all elements from #visible aside from the header */
        while (visible.childNodes.length > 2) {
                visible.removeChild(visible.lastChild);
        }
        while (invisible.childNodes.length > 2) {
                invisible.removeChild(invisible.lastChild);
        }
	turnMeterDisplay();
	DataPool.sort(compareAllVals);
        for (var i in DataPool) {
                appendList(DataPool[i]);
        }
}
function timer() {
        while (!paused && DataPool.length != 0) {
                for (var i in DataPool) {
                        if (Number(DataPool[i].Current) >= 100) {
                                paused = true;
                        }
                        DataPool[i].Current += DataPool[i].Gain;
                }
		sendToBackend();
                drawGrid();
        }
}

function reset() {
        if (confirm("Are you sure you want to reset everything?")) {
                DataPool = [];
		sendToBackend()
                drawGrid();
        }
}
function deleteRow(currObj) {
	for (var i in DataPool) {
	        if (DataPool[i].Id == currObj.Id) {
	                DataPool.splice(i, 1);
			IdPool.push(currObj.Id);
			IdPool.sort(function(a,b){return b - a});
	        }
	}
	sendToBackend();
	drawGrid();
}
function rest(currObj) {
	for (var i in DataPool) {
	        if (DataPool[i].Id == currObj.Id) {
	                DataPool[i].Current = 25;
	        }
	}
	sendToBackend();
	drawGrid();
}
function zeroOut(currObj) {
	for (var i in DataPool) {
	        if (DataPool[i].Id == currObj.Id) {
	                DataPool[i].Current = 0;
	        }
	}
	sendToBackend();
	drawGrid();
}
function swapVisible(swapTo, currObj) {
	for (var i in DataPool) {
		if (DataPool[i].Id == currObj.Id) {
			DataPool[i].Visible = swapTo;
		}
	}
	sendToBackend();
	drawGrid();
}
function turnMeterDisplay() {
	var percent = (TurnMeter.Current / TurnMeter.Max) * 100;
	if (TurnMeter.Max != 0) {
		$("#turnForeground").css("width", percent + "%");
	} else {
		$("#turnForeground").css("width", "0%");
	}

	if (percent > 70) {
		document.getElementById("turnForeground").style.backgroundColor = "green";
	} else if (percent <= 70 && percent > 30) {
		document.getElementById("turnForeground").style.backgroundColor = "#cccc22";
	} else {
		document.getElementById("turnForeground").style.backgroundColor = "red";
	}

	document.getElementById("turnForeground").textContent = TurnMeter.Current;
}
function appendList(currObj) {
        var name = currObj.Name;
        var gain = currObj.Gain;
        var curr = currObj.Current;
        /*
         * Feels weird creating so many variables just to discard them
         * I don't think there's a better method of doing this though.
         */
        var currentTable  = getCurrentTable(currObj.Visible);
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
	if (logged) {
		var nameInput = document.createElement("input");
		nameInput.type  = "text";
		nameInput.name  = "name";
		nameInput.value = name;
		name_element.appendChild(nameInput);
	} else {
		name_element.textContent = name;
	}

	if (logged) {
		var gainInput = document.createElement("input");
		gainInput.type  = "text";
		gainInput.name  = "gain";
		gainInput.value = gain;
		gain_element.appendChild(gainInput);
	} else {
		gain_element.textContent = gain;
	}

	if (logged) {
		var currInput = document.createElement("input");
		currInput.type  = "text";
		currInput.name  = "curr";
		currInput.value = curr;
		curr_element.appendChild(currInput);
	} else {
		curr_element.textContent = curr;
	}

	if (logged) {
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
		
		var swap_visible = document.createElement("input");
		swap_visible.type  = "button";
		swap_visible.name  = "visibility";
		if (currentTable == document.getElementById("visible")) {
			swap_visible.value = "Hide from players";
			swap_visible.onclick = function() { swapVisible(false, currObj) };
		} else {
			swap_visible.value = "Show to players";
			swap_visible.onclick = function() { swapVisible(true, currObj) };
		}

		opt_element.appendChild(hiddInput);
		opt_element.appendChild(delete_button);
		opt_element.appendChild(zero_button);
		opt_element.appendChild(swap_visible);
		opt_element.appendChild(rest_button);
	}
        
	row_element.appendChild(meter_element);
	row_element.appendChild(name_element);
	row_element.appendChild(gain_element);
	row_element.appendChild(curr_element);
	if (logged)
		row_element.appendChild(opt_element);
	
	currentTable.appendChild(row_element);
}
$(document).ready(function() {
        $( "#new" ).submit(function( event ) {
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
                        if (i == 0 || i == 3 ) {
                                arrayList.push(newList[i].value);
                        } else {
				arrayList.push(Number(newList[i].value));
			}

                }
		/*
		 * Extra code required since HTML checkboxes are weird
		 * There's probably a better solution to this
		 */
		var tempObj = {};
		var tempId;
		if (IdPool.length > 0) {
               		tempId = IdPool.pop();
		} else {
			tempId = DataPool.length;
		}

		if (arrayList.length == 3) {
			tempObj = {Name: arrayList[0], Gain: arrayList[1], Current: arrayList[2], Id: tempId, Visible: false}
		} else {
			tempObj = {Name: arrayList[0], Gain: arrayList[1], Current: arrayList[2], Id: tempId, Visible: true} 
		}

                DataPool.push(tempObj);

		sendToBackend();
                drawGrid();
                event.preventDefault();
        });

	$( "#login" ).submit(function( event ) {
                event.preventDefault();
		var data = $( this ).serializeArray();
		var data2 = {};
		data2.Username = data[0].value;
		data2.Password = data[1].value;
		var info = JSON.stringify(data2);

		$.ajax({
			method: "POST",
			url: "/login",
			contentType: "application/json; charset=utf-8",
			data: info,
			error: function(error) {
				$("#statusBar").text("Log-in failed!");
			},
			success: function (response) {
				location.reload();
			}
		});
        });

	$( "#turnMeterForm" ).submit(function( event ) {
		event.preventDefault();
		var data = $( this ).serializeArray();
		TurnMeter.Current = Number(data[0].value);
		TurnMeter.Max     = Number(data[0].value);
		sendToBackend();
	});


        /* automatically updates DataPool when an input changes */
        $("#visible, #invisible").on("change", ":input", function () {
                var siblings = $(this).parent().parent().find("input");
                var id = siblings[3].value;
                for (var i in DataPool) {
                        if (DataPool[i].Id == id) {
                                DataPool[i].Name    = siblings[0].value;
                                DataPool[i].Gain    = Number(siblings[1].value);
                                DataPool[i].Current = Number(siblings[2].value);
                        }
                }
		sendToBackend();
                drawGrid();
        });
});
