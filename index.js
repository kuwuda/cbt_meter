/* 
 * Will be a global multi-dimensional array
 * This is the most convenient appraoch for this case
 * Values are: name, ap gain, current ap, id
 */
var paused = true;
var allVals = [
        ['Kusuda', 7, 0, 0],
        ['Ajoke',  6, 0, 1],
        ['Sophia', 6, 0, 2]
];
function reset() {
        if (confirm("Are you sure you want to reset everything?")) {
                allVals = [];
                drawGrid();
        }
}
function drawGrid() {
        visible = document.getElementById("visible")
        /* Removes all elements from #visible aside from the header */
        while (visible.childNodes.length > 2) {
                visible.removeChild(visible.lastChild);
        }
        for (var i in allVals) {
                appendList(allVals[i], true);
        }
}
function timer() {
        while (!paused && allVals.length != 0) {
                for (var i in allVals) {
                        if (Number(allVals[i][2]) >= 100) {
                                paused = true;
                        }
                        allVals[i][2] += allVals[i][1];
                }
                drawGrid();
        }
}
function getCurrentTable(visible) {
        if (visible == true) {
                return document.getElementById("visible");
        } else {
                return document.getElementById("invisible");
        }
}
function appendList(currArray, visible) {
        var name = currArray[0];
        var gain = currArray[1];
        var curr = currArray[2];
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
        hiddInput.value = currArray[3];
        opt_element.appendChild(hiddInput);

        var delete_button = document.createElement("input");
        delete_button.type    = "button";
        delete_button.name    = "delete";
        delete_button.value   = "Delete";
        delete_button.onclick = function() { 
                                                for (var i in allVals) {
                                                        if (allVals[i][3] == currArray[3]) {
                                                                allVals.splice(i, 1);
                                                        }
                                                }
                                                drawGrid();
                                           };
        var zero_button = document.createElement("input");
        zero_button.type    = "button";
        zero_button.name    = "zero";
        zero_button.value   = "Zero Out Meter";
        zero_button.onclick = function () {
                                                for (var i in allVals) {
                                                        if (allVals[i][3] == currArray[3]) {
                                                                allVals[i][2] = 0;
                                                        }
                                                }
                                                drawGrid();
                                          };

        var rest_button = document.createElement("input");
        rest_button.type    = "button";
        rest_button.name    = "rest";
        rest_button.value   = "Rest";
        rest_button.onclick = function () {
                                                for (var i in allVals) {
                                                        if (allVals[i][3] == currArray[3]) {
                                                                allVals[i][2] = 25;
                                                        }
                                                }
                                                drawGrid();
                                          };

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
                arrayList.push(20);
                allVals.push(arrayList);
                drawGrid();
                event.preventDefault();
        });

        /* automatically updates allVals when an input in #visible changes */
        $("#visible").on("change", ":input", function () {
                var siblings = $(this).parent().parent().find("input");
                var id = siblings[3].value;
                for (var i in allVals) {
                        if (allVals[i][3] == id) {
                                allVals[i][0] = siblings[0].value;
                                allVals[i][1] = Number(siblings[1].value);
                                allVals[i][2] = Number(siblings[2].value);
                        }
                }
                drawGrid();
        });

        drawGrid();
});

