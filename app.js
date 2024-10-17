/*
    *   Canvas Loading & Editing    *
*/

let currentCanvas = null;
let noteId = 0;
let canvasStorageKey = "solidifyCanvas"


// Load canvases from localStorage
function loadCanvases() {
    const canvasData = JSON.parse(localStorage.getItem(canvasStorageKey)) || {};
    const canvasSelect = document.getElementById('canvasSelect');

    // Clear previous options (except the default ones)
    while (canvasSelect.options.length > 2) {
        canvasSelect.remove(2);
    }

    // Add existing canvases to select dropdown
    Object.keys(canvasData).forEach(canvasName => {
        const option = document.createElement('option');
        option.value = canvasName;
        option.textContent = canvasName;
        canvasSelect.prepend(option);
    });
}

// Save the current canvas and notes to localStorage
// Save the current canvas and notes to localStorage with rename capability
function saveCanvasToLocalStorage(newCanvasName = currentCanvas) {
    if (!currentCanvas) return;

    const notes = document.querySelectorAll(".note");
    const notesArray = Array.from(notes).map(note => ({
        id: note.id,
        title: note.querySelector("h2").innerText,
        content: note.querySelector(".content").innerText,
        top: note.style.top,
        left: note.style.left,
        color: note.querySelector(".color-picker").value
    }));

    // Retrieve current canvas transformation state (translation and scale)
    const canvasTransform = {
        translateX: translateX, // X-axis translation
        translateY: translateY, // Y-axis translation
        scale: scale            // Zoom level
    };

    // Retrieve existing canvas data from localStorage
    const canvasData = JSON.parse(localStorage.getItem(canvasStorageKey)) || {};

    // Rename canvas if a new name is provided and differs from the current one
    if (newCanvasName !== currentCanvas) {
        canvasData[newCanvasName] = canvasData[currentCanvas];
        delete canvasData[currentCanvas]; // Remove the old canvas entry
    }

    // Save both the notes and the transformation for the (new) canvas
    canvasData[newCanvasName] = {
        notes: notesArray,
        transform: canvasTransform // Include the transformation state
    };

    // Save the updated canvas data to localStorage
    localStorage.setItem(canvasStorageKey, JSON.stringify(canvasData));

    // Update the current canvas to the new name (if renamed)
    currentCanvas = newCanvasName;
}


function deleteCanvas() {
    const selectedCanvas = document.getElementById("canvasSelect").value;
    const canvasData = JSON.parse(localStorage.getItem(canvasStorageKey)) || {};

    if (selectedCanvas in canvasData && window.confirm(`Are you sure you want to delete your canvas "${selectedCanvas}"?`)) {
        delete canvasData[selectedCanvas];

        // Remove the canvas from the dropdown
        const canvasOption = document.querySelector(`#canvasSelect option[value="${selectedCanvas}"]`);
        if (canvasOption) {
            canvasOption.remove();
            canvasOption.value = "";
        }

        // Clear notes if the deleted canvas is the currently active one
        if (selectedCanvas === currentCanvas) {
            document.getElementById("container").innerHTML = ""; // Clear all notes
            currentCanvas = null;
            noteId = 0; // Reset noteId counter
        }

        // Store new canvasData without deleted canvas
        localStorage.setItem(canvasStorageKey, JSON.stringify(canvasData));
        currentCanvas = null;

        window.location.reload();
    }
}

/*
    *   Canvas Management    *
*/

// Canvas Management Control
function switchCanvas() {
    // remove select popup, make control buttons visible
    document.getElementById('precanvas-popup').style.display='none';
    document.querySelector('.container-buttons').style.visibility='visible';
    
    const selectedCanvas = document.getElementById("canvasSelect").value;
    // if canvas selectd is a new canvas request
    if (selectedCanvas === "~~newCanvasRequest") {
        saveCanvasToLocalStorage(); // save old canvas
        const newCanvasName = prompt("Enter a new canvas name:");
        if (newCanvasName) {
            currentCanvas = newCanvasName;
            var opt = document.createElement("option");
            opt.value = newCanvasName;
            opt.innerText = newCanvasName;
            document.getElementById("canvasSelect").prepend(opt);
            document.getElementById("canvasSelect").value = newCanvasName;
            loadNotesFromLocalStorage(); // Load notes for the selected canvas
            saveCanvasToLocalStorage(); // Initialize the new canvas in storage
        } else {
            // if new canvas initiative was canceled, just switch back to the currentCanvas
            document.getElementById("canvasSelect").value = currentCanvas;
        }
    } else if (selectedCanvas) {
        currentCanvas = selectedCanvas;
        console.log("loading selected canvas:", selectedCanvas, localStorage.getItem(canvasStorageKey));
        loadNotesFromLocalStorage(); // Load notes for the selected canvas
        saveCanvasToLocalStorage();
    }
}

// Load notes for the selected canvas
function loadNotesFromLocalStorage() {
    const container = document.getElementById("container");
    container.innerHTML = ""; // Clear existing notes

    if (!currentCanvas) return;

    const canvasData = JSON.parse(localStorage.getItem(canvasStorageKey)) || {};
    const currentCanvasData = canvasData[currentCanvas] || {};
    const notesArray = currentCanvasData.notes || [];
    const transform = currentCanvasData.transform || { translateX: 0, translateY: 0, scale: 1 };

    document.getElementById('canvasTitle').innerText = currentCanvas;

    // Apply the saved transform (translation and scale) to the canvas
    translateX = transform.translateX;
    translateY = transform.translateY;
    scale = transform.scale;
    applyTransform(); // Function to update the transform on the canvas

    updateNoteIdCounter(notesArray); // Update noteId counter based on loaded notes

    // Load the notes into the container
    notesArray.forEach(note => {
        const newNote = document.createElement("div");
        newNote.className = "note";
        newNote.id = note.id;
        newNote.innerHTML = `
            <div class="header">
                <h2 contenteditable="true">${note.title}</h2>
            </div>
            <div class="content" contenteditable="true">${note.content}</div>
            <div class="controls">
                <input type="color" class="color-picker" onchange="changeNoteColor('${note.id}', this.value)" value="${note.color}">
                <span class="delete" onclick="deleteStickyNote('${note.id}')"><i class="fa-light fa-trash-can"></i></span>
            </div>
        `;
        newNote.style.top = note.top;
        newNote.style.left = note.left;
        newNote.style.backgroundColor = note.color;
        newNote.addEventListener("mousedown", startDrag);
        newNote.addEventListener("touchstart", startDrag);
        addSaveHandler(newNote);
        container.appendChild(newNote);
    });
}

// Ensure unique IDs after loading notes
function updateNoteIdCounter(notesArray) {
    if (notesArray.length > 0) {
        const highestId = Math.max(...notesArray.map(note => parseInt(note.id.split('_')[1])));
        noteId = highestId + 1; // Set noteId to one greater than the highest existing ID
    } else {
        noteId = 0; // Reset noteId for new canvas
    }
}

/*
    *   Note Management    *
*/

// Connect linked notes
var drawConnector = function(divA, divB) {
    var connector = document.createElement('div');
  var posnA = {
    x: divA.offsetLeft + divA.offsetWidth,
    y: divA.offsetTop  + divA.offsetHeight / 2
  };
  var posnB = {
    x: divB.offsetLeft,
    y: divB.offsetTop  + divA.offsetHeight / 2
  };
  var dStr =
      "M" +
      (posnA.x      ) + "," + (posnA.y) + " " +
      "C" +
      (posnA.x + 100) + "," + (posnA.y) + " " +
      (posnB.x - 100) + "," + (posnB.y) + " " +
      (posnB.x      ) + "," + (posnB.y);
  connector.setAttribute("d", dStr);
  document.body.append(connector);
}


// Create a new sticky note
function createStickyNote() {
    if (!currentCanvas) {
        alert("Please select or create a canvas first!");
        return;
    }

    const container = document.getElementById("container");
    const note = document.createElement("div");
    note.className = "note";
    note.id = "note_" + noteId;
    note.innerHTML = `
            <div class="header">
                <h2 contenteditable="true" onclick="hidePlaceholder(this, 'New Note')">New Note</h2>
            </div>
            <div class="content" contenteditable="true" onclick="hidePlaceholder(this, 'Your note content')">Your note content</div>
            <div class="controls">
                <input type="color" class="color-picker" value="#ffffff" onchange="changeNoteColor('${note.id}', this.value)">
                <span class="delete" onclick="deleteStickyNote('${note.id}')"><i class="fa-light fa-trash-can"></i></span>
            </div>
        `;

    // Get the center of the screen based on current zoom (scale) and pan (translateX, translateY)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate the center position in relation to the canvas transformation (translate and scale)
    const centerX = (viewportWidth / 2 - translateX) / scale;
    const centerY = (viewportHeight / 2 - translateY) / scale;

    // Set the new note's position to the calculated center
    note.style.left = `${centerX}px`;
    note.style.top = `${centerY}px`;

    noteId++;
    note.addEventListener("mousedown", startDrag);
    note.addEventListener("touchstart", startDrag);
    addSaveHandler(note);
    container.appendChild(note);

    saveCanvasToLocalStorage(); // Save the new note to the current canvas
}


function hidePlaceholder(element, placeholder) {
    /*if (element.innerText === placeholder) {
        element.innerText = "";
    }*/
}

// Delete a sticky note
function deleteStickyNote(noteId) {
    const note = document.getElementById(noteId);
    note.remove();
    saveCanvasToLocalStorage(); // Save changes after deletion
}

/*
    *   Canvas Interactions   *
*/

// Drag functionality for notes
// Include both note.addEventListener("mousedown", startDrag) and note.addEventListener("touchstart", startDrag);
function startDrag(event) {
    let note = event.target;
    let offsetX, offsetY;
    if (event.type === "mousedown") {
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        offsetX = mouseX - note.offsetLeft;
        offsetY = mouseY - note.offsetTop;
        document.addEventListener("mousemove", dragNote);
        document.addEventListener("mouseup", stopDrag);
    } else if (event.type === "touchstart") {
        const touch = event.touches[0];
        offsetX = touch.clientX - note.offsetLeft;
        offsetY = touch.clientY - note.offsetTop;
        document.addEventListener("touchmove", dragNote);
        document.addEventListener("touchend", stopDrag);
    }

    function dragNote(event) {
        if (event.type === "mousemove") {
            note.style.left = (event.clientX - offsetX) + "px";
            note.style.top = (event.clientY - offsetY) + "px";
        } else if (event.type === "touchmove") {
            const touch = event.touches[0];
            note.style.left = (touch.clientX - offsetX) + "px";
            note.style.top = (touch.clientY - offsetY) + "px";
        }
    }

    function stopDrag() {
        document.removeEventListener("mousemove", dragNote);
        document.removeEventListener("mouseup", stopDrag);
        document.removeEventListener("touchmove", dragNote);
        document.removeEventListener("touchend", stopDrag);
        saveCanvasToLocalStorage();  // Save position changes
    }
}


// Color picker for sticky note background
function changeNoteColor(noteId, color) {
    const note = document.getElementById(noteId);
    note.style.backgroundColor = color;
    saveCanvasToLocalStorage();
}

// Save handler for sticky notes
function addSaveHandler(elem) {
    elem.addEventListener('keyup', function (e) {
        saveCanvasToLocalStorage();
    });
}

/*
    *   Canvas Zooming and Panning    *
*/

let scale = 1;
let translateX = 0, translateY = 0; // Initial pan offsets from center
let isPanning = false;
let isEditingOrMovingNote = false; // New flag to disable pan/zoom during note interactions
let startX, startY;
let startTouchX, startTouchY;
let startDistance = 0;

// Get the canvas and container elements
const canvasWrapper = document.querySelector(".canvas-wrapper");
const container = document.getElementById("container");

// Apply the transform (translation and scaling)
function applyTransform() {
    container.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`;
    saveCanvasToLocalStorage();
}

// Prevent panning and zooming when notes are edited or dragged
document.addEventListener("mousedown", function(e) {
    // If the target is inside a note, disable panning
    if (e.target.closest(".note")) {
        isEditingOrMovingNote = true;
    }
});

document.addEventListener("mouseup", function() {
    isEditingOrMovingNote = false;
});

document.addEventListener("touchstart", function(e) {
    // If the target is inside a note, disable panning
    if (e.target.closest(".note")) {
        isEditingOrMovingNote = true;
    }
});

document.addEventListener("touchend", function() {
    isEditingOrMovingNote = false;
});

// Panning with mouse (desktop)
canvasWrapper.addEventListener("mousedown", function(e) {
    if (isEditingOrMovingNote || !currentCanvas) return; // Disable pan if interacting with a note or there is no canvas active

    isPanning = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    canvasWrapper.style.cursor = 'grabbing';
});

canvasWrapper.addEventListener("mousemove", function(e) {
    if (!isPanning || isEditingOrMovingNote) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyTransform();
});

canvasWrapper.addEventListener("mouseup", function() {
    isPanning = false;
    canvasWrapper.style.cursor = 'default';
});

canvasWrapper.addEventListener("mouseleave", function() {
    isPanning = false;
});

// Zoom with mouse wheel (desktop)
canvasWrapper.addEventListener('wheel', function(e) {
    if (isEditingOrMovingNote || !currentCanvas) return; // Disable zoom if interacting with a note or there is no canvas active

    const zoomFactor = 0.1;
    if (e.deltaY > 0) {
        scale = Math.max(0.3, scale - zoomFactor); // Zoom out
    } else {
        scale = Math.min(3, scale + zoomFactor);   // Zoom in
    }
    applyTransform();
});

// Touch-based panning and pinch-to-zoom
canvasWrapper.addEventListener("touchstart", function(e) {
    if (isEditingOrMovingNote || !currentCanvas) return; // Disable pan/zoom if interacting with a note or there is no canvas active

    if (e.touches.length === 2) {
        // Pinch-to-zoom
        startDistance = getDistance(e.touches[0], e.touches[1]);
    } else if (e.touches.length === 1) {
        // Single finger for panning
        isPanning = true;
        const touch = e.touches[0];
        startTouchX = touch.clientX - translateX;
        startTouchY = touch.clientY - translateY;
    }
});

canvasWrapper.addEventListener("touchmove", function(e) {
    if (isEditingOrMovingNote || !currentCanvas) return; // Disable pan/zoom if interacting with a note or there is no canvas active

    if (e.touches.length === 2) {
        // Handle pinch-to-zoom
        const newDistance = getDistance(e.touches[0], e.touches[1]);
        const pinchScale = newDistance / startDistance;
        scale = Math.min(3, Math.max(0.3, scale * pinchScale)); // Restrict zoom levels
        applyTransform();
        startDistance = newDistance; // Update for the next move
    } else if (e.touches.length === 1 && isPanning) {
        // Handle panning with single finger
        const touch = e.touches[0];
        translateX = touch.clientX - startTouchX;
        translateY = touch.clientY - startTouchY;
        applyTransform();
    }
});

canvasWrapper.addEventListener("touchend", function() {
    isPanning = false;
});

// Helper function to calculate distance between two touch points (for pinch-zoom)
function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/*
    *   Canvas Title Editing/Renaming    *
*/
document.getElementById("canvasTitle").addEventListener('dblclick', function(e) {
    e.preventDefault();
    this.contentEditable=true;
});

document.getElementById("canvasTitle").addEventListener('blur', function(e) {
    e.preventDefault();
    this.contentEditable=false;
    if(this.innerText == "" || this.innerText == null) {
        this.innerText = "My Canvas";
    }
    // change opt text + value to reflect new
    var opt = document.querySelector(`select option[value="${currentCanvas}"]`);
    opt.value = this.innerText;
    opt.innerText = this.innerText;
    saveCanvasToLocalStorage(this.innerText); // update title in storage
});

document.body.addEventListener('keypress', function(e) {
    var titleRestrictedKeys = ["Enter", ">", "<", "\"", "\'", "\`"];
    // restrict "unsafe" keys in canvas title and disable enter in note titles
    if((titleRestrictedKeys.includes(e.key) && e.target.tagName.toLowerCase() == "h1") || (e.key == "Enter" && e.target.tagName.toLowerCase() == "h2")) {
        e.preventDefault();
    }
});

/*
    *   Controls Event Listeners    *
*/

document.querySelector('#new-note').addEventListener('click', createStickyNote);

document.querySelector('#delete-canvas').addEventListener('click', deleteCanvas);

document.querySelector('#zoom-in').addEventListener('click', function() {
    scale = Math.min(3, scale + 0.1);   // Zoom in
    applyTransform();
});
document.querySelector('#zoom-out').addEventListener('click', function() {
    scale = Math.max(0.3, scale - 0.1); // Zoom out
    applyTransform();
});

window.addEventListener('resize', function() {
    // Reapply the canvas transform (translateX, translateY, scale) and resave it so notes are not lost
    applyTransform();
});




/*
    *   App Init    *
*/
// Initialize the app by loading canvases from localStorage
window.addEventListener("DOMContentLoaded", function () {
    loadCanvases(); // Load the first canvas if any
    //switchCanvas();
});

function linkNotes() {
    drawConnector(document.querySelector('#note_0'), document.querySelector('#note_1'));
}