var paused = true;
var DataPool = Array();
var IdPool = Array();
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
	document.getElementById("statusBar").textContent = "WebSocket connection closed! Please refresh the page.";
}

function serializeArray(form) {
	var field, l, s = [];
	if (typeof form == 'object' && form.nodeName == "FORM") {
		var len = form.elements.length;
		for (var i=0; i<len; i++) {
			field = form.elements[i];
			if (field.name && !field.disabled && field.type != 'file' && field.type != 'reset' && field.type != 'submit' && field.type != 'button') {
				if (field.type == 'select-multiple') {
					l = form.elements[i].options.length; 
					for (j=0; j<l; j++) {
						if(field.options[j].selected)
						s[s.length] = { name: field.name, value: field.options[j].value };
					}
				} else if ((field.type != 'checkbox' && field.type != 'radio') || field.checked) {
					s[s.length] = { name: field.name, value: field.value };
				}
			}
		}
	}
	return s;
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
	fetch("/refresh", { method: "GET", credentials: "same-origin", });
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
	if (!paused && DataPool.length != 0) {
        	while (!paused && DataPool.length != 0) {
        	        for (var i in DataPool) {
        	                DataPool[i].Current += DataPool[i].Gain;
        	                if (Number(DataPool[i].Current) >= 100) {
        	                        paused = true;
					for (var n in DataPool[i].PTE) {
						var pte = DataPool[i].PTE[n];
						if (pte.Turns > 0) {
							pte.Turns--;
						} else {
							deletePTE(DataPool[i].Id, pte);
						}
					}
        	                }
        	        }
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
function newPTE(currObj) {
	var tempId;
	if (currObj.PTEIdPool.length > 0) {
		tempId = currObj.PTEIdPool.pop();
	} else {
		tempId = currObj.PTE.length;
	}
	currObj.PTE.push({"Name": "Name", "Turns": 1, "Id": tempId});
	sendToBackend();
	drawGrid();
}
function deletePTE(rowId, pte) {
	for (var i in DataPool) {
		if (DataPool[i].Id == rowId) {
			for (var n in DataPool[i].PTE) {
				if (DataPool[i].PTE[n].Id == pte.Id) {
					DataPool[i].PTE.splice(n, 1);
					DataPool[i].PTEIdPool.push(pte.Id);
					DataPool[i].PTEIdPool.sort(function(a,b){return b - a});
				}
			}
		}
	}
	sendToBackend();
	drawGrid();
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
		document.getElementById("turnForeground").style.width = percent + "%";
	} else {
		document.getElementById("turnForeground").style.width = "0%";
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

/* 
 * appendList adds the JS data to the html
 */
function appendList(currObj) {
        var name = currObj.Name;
        var gain = currObj.Gain;
        var curr = currObj.Current;
	var pte  = currObj.PTE;
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
	var pte_element   = document.createElement("td");
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

	/*
	 * if the user is logged in, display editing features
	 * if not, just display results
	 */
	if (logged) {
		/* name input */
		var nameInput = document.createElement("input");
		nameInput.type  = "text";
		nameInput.name  = "name";
		nameInput.value = name;
		name_element.appendChild(nameInput);

		/* AP gain input */
		var gainInput = document.createElement("input");
		gainInput.type  = "text";
		gainInput.name  = "gain";
		gainInput.value = gain;
		gain_element.appendChild(gainInput);

		/* current AP input */
		var currInput = document.createElement("input");
		currInput.type  = "text";
		currInput.name  = "curr";
		currInput.value = curr;
		curr_element.appendChild(currInput);

		/* pte array input */
		if (pte != []) {
			for (var i in pte) {
				var pteForm = document.createElement("form");
				var pteName = document.createElement("input");
				pteName.type  = "text";
				pteName.name  = "pteName";
				pteName.value = pte[i].Name;

				var pteTurn = document.createElement("input");
				pteTurn.type = "text";
				pteTurn.name = "pteTurn";
				pteTurn.value = pte[i].Turns;

				var pteId = document.createElement("input");
				pteId.type  = "hidden";
				pteId.name  = "pteId";
				pteId.value = pte[i].Id;

				var pteDelete = document.createElement("input");
				pteDelete.type  = "button";
				pteDelete.name  = "pteDelete";
				pteDelete.value = "-";
				pteDelete.onclick = function(){deletePTE(currObj.Id, pte[i])};

				pteForm.appendChild(pteName);
				pteForm.appendChild(pteTurn);
				pteForm.appendChild(pteId);
				pteForm.appendChild(pteDelete);
				pte_element.appendChild(pteForm);
			}
		}

		/* for adding new ptes */
		var pteNew = document.createElement("input");
		pteNew.type  = "button";
		pteNew.name  = "pteNew";
		pteNew.value = "+";
		pteNew.onclick = function(){newPTE(currObj)};
		pte_element.appendChild(pteNew);

		/* all of the options */
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
	} else {
		name_element.textContent = name;
		gain_element.textContent = gain;
		curr_element.textContent = curr;
		if (pte != []) {
			for (var i in pte) {
				var pteName = document.createElement("span");
				pteName.textContent = pte[i].Name + ": ";

				var pteTurn = document.createElement("span");
				pteTurn.textContent = pte[i].Turns;

				pte_element.appendChild(pteName);
				pte_element.appendChild(pteTurn);
			}
		}
	}
	
	row_element.appendChild(meter_element);
	row_element.appendChild(name_element);
	row_element.appendChild(gain_element);
	row_element.appendChild(curr_element);
	row_element.appendChild(pte_element);
	if (logged)
		row_element.appendChild(opt_element);
	
	currentTable.appendChild(row_element);
}
window.onload = function () {
	if (logged) {
		document.getElementById("new").addEventListener("submit", function( event ) {
			event.preventDefault();
			/*
        		 * Make sure to secure this against XSS attacks
        		 * Probably just HTML / JS encode data before doing anything with it
			 *
			 * I could probably skip one of these steps
        		 */
        		var newList = serializeArray(this);
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

			/* 
			 * tempobj is our new obj to add to DataPool.
			 * PTE is a blank array since there isnt an option to add it when creating a new row
			 */
			if (arrayList.length == 3) {
				tempObj = {Name: arrayList[0], Gain: arrayList[1], Current: arrayList[2], PTE: [], PTEIdPool: [], Id: tempId, Visible: false}
			} else {
				tempObj = {Name: arrayList[0], Gain: arrayList[1], Current: arrayList[2], PTE: [], PTEIdPool: [], Id: tempId, Visible: true} 
			}

        		DataPool.push(tempObj);

			sendToBackend();
        		drawGrid();
		});

		document.getElementById("turnMeterForm").addEventListener("submit", function( event ) {
			event.preventDefault();
			var data = serializeArray(this);
			TurnMeter.Current = Number(data[0].value);
			TurnMeter.Max     = Number(data[0].value);
			sendToBackend();
		});
	} else {
		document.getElementById("login").addEventListener("submit", function( event ) {
        	        event.preventDefault();
			var data = serializeArray(this);
			var data2 = {};
			data2.Username = data[0].value;
			data2.Password = data[1].value;
			var info = JSON.stringify(data2);

			fetch("/login", {
				method: "POST",
				mode: "same-origin",
				credentials: "same-origin",
				headers: {
					"Content-Type": "application/json; charset=utf-8"
				},
				body: info,
			}).then(function(response) {
				if (!response.ok) {
					document.getElementById("statusBar").textContent = "Log-in failed!";
				} else {
					location.reload();
				}
			});
        	});
	}


	/* This is a total mess and I refuse to improve it. maybe one of the worst things i've ever made */
	function updateDataPool(element) {
		var siblings;
		if (element.name == "pteName" || element.name == "pteTurn") {
			siblings = element.parentElement.parentElement.parentElement.querySelectorAll("input");
		} else {
			siblings = element.parentElement.parentElement.querySelectorAll("input");
		}
		/* iterate through all of our siblings to find the id */
		var id;
		for (var i in siblings) {
			if (siblings[i].name == "id") {
				id = siblings[i].value;
			}
		}
		/* update DataPool by matching datapool id to sibling id */
                for (var i in DataPool) {
                        if (DataPool[i].Id == id) {
				/* ifs so we only update the value that was changed */
				if (element.name == "name") {
					DataPool[i].Name = element.value;
				} else if (element.name == "gain") {
					DataPool[i].Gain = Number(element.value);
				} else if (element.name == "curr") {
					DataPool[i].Current = Number(element.value);
				} else if (element.name == "pteName" || element.name == "pteTurn") {
					/* find PTE Id */
					var pteSiblings = element.parentElement.querySelectorAll("input");
					var pteId;
					for (var n in pteSiblings) {
						if (pteSiblings[n].name == "pteId") {
							pteId = pteSiblings[n].value;
						}
					}
					for (var n in DataPool[i].PTE) {
						if (DataPool[i].PTE[n].Id == pteId) {
							if (element.name == "pteName") {
								DataPool[i].PTE[n].Name = element.value;
							} else {
								DataPool[i].PTE[n].Turns = Number(element.value);
							}
						}
					}
				}
                        }
                }
		sendToBackend();
                drawGrid();

	}

        /* automatically updates DataPool when an input changes */
	var visible = document.getElementById("visible");
	visible.addEventListener('change', function(event) {
		if (event.target.matches('input')) {
			updateDataPool(event.target);
	  	}
	});

	var invisible = document.getElementById("visible");
	invisible.addEventListener('change', function(event) {
		if (event.target.matches('input')) {
			updateDataPool(event.target);
	  	}
	});
}
