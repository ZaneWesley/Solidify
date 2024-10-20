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
        //content: note.querySelector(".content").innerText,
        //content: note.querySelector(".content").innerHTML, // Save the Quill editor content as HTML
        content: note.querySelector(".ql-editor").innerHTML.replace(/(<p><br><\/p>\s*|<p><\/p>\s*)+$/, ''),// remove leading and trailing whitespace and <br>,
        top: note.style.top,
        left: note.style.left,
        width: note.style.width,
        height: note.style.height,
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
        console.log(`Loading canvas "${selectedCanvas}"...`);
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
            <div class="content">${note.content}</div>
            <div class="controls">
                <input type="color" class="color-picker" onchange="changeNoteColor('${note.id}', this.value)" value="${note.color}">
                <span class="delete" onclick="deleteStickyNote('${note.id}')"><i class="fa-light fa-trash-can"></i></span>
            </div>
        `;
        newNote.style.top = note.top;
        newNote.style.left = note.left;
        newNote.style.width = note.width;
        newNote.style.height = note.height;
        var bgCol = hexToRgb(note.color);
        newNote.style.borderColor = note.color;
        newNote.style.backgroundColor = `rgba(${bgCol.r}, ${bgCol.g}, ${bgCol.b}, 0.1)`;

        addNoteHandlers(newNote);
        container.appendChild(newNote);

        // Initialize Quill editor with the saved content
        const quill = new Quill(newNote.querySelector('.content'), {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': 1 }, { 'header': 2 }], // title format
                    ['bold', 'italic', 'underline', 'link'], // text formatting
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
                    [{ 'script': 'sub'}, { 'script': 'super' }]
                    //['clean'] // remove formatting button
                ]
            }
        });
        quill.innerHTML = note.content; // Set the saved HTML content into Quill
        // display toolbar on edit
        const quillEditor = newNote.querySelector('.ql-editor');
        if (quillEditor) {
            quillEditor.addEventListener('focus', () => {
                isEditingOrMovingNote = true;
                isEditingText = true;
                newNote.querySelector('.ql-toolbar').style.display="block";
            });

            quillEditor.addEventListener('blur', () => {
                isEditingOrMovingNote = false;
                isEditingText = false;
                window.scrollTo(0, 0);
                document.body.style.zoom=1.0;
                //newNote.querySelector('.ql-toolbar').style.display="none";
            });
        }
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
    let noteColors = ["#81dde9", "#e7e981", "#7edd9a", "#a081e9", "#d281e9", "#e98181", "#e9be81"]; // blue, yellow, green, purple, pink, red, orange
    let chosenColor = noteColors[Math.floor(Math.random()*noteColors.length)];
    note.className = "note";
    note.id = "note_" + noteId;
    note.innerHTML = `
            <div class="content" onclick="hidePlaceholder(this, 'Your note content')"></div>
            <div class="controls">
                <input type="color" class="color-picker" value="${chosenColor}" onchange="changeNoteColor('${note.id}', this.value)">
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
    var bgCol = hexToRgb(chosenColor);
    note.style.borderColor = chosenColor;
    note.style.backgroundColor = `rgba(${bgCol.r}, ${bgCol.g}, ${bgCol.b}, 0.1)`;

    noteId++;

    addNoteHandlers(note);
    container.appendChild(note);

    // Initialize Quill editor for this note
    const quill = new Quill(note.querySelector('.content'), {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': 1 }, { 'header': 2 }], // title format
                ['bold', 'italic', 'underline', 'link'], // text formatting
                [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
                [{ 'script': 'sub'}, { 'script': 'super' }]
                //['clean'] // remove formatting button
            ]
        }
    });
    // display toolbar on edit
    const quillEditor = note.querySelector('.ql-editor');
    if (quillEditor) {
        quillEditor.addEventListener('focus', () => {
            isEditingOrMovingNote = true;
            isEditingText = true;
            note.querySelector('.ql-toolbar').style.display="block";
        });

        quillEditor.addEventListener('blur', () => {
            isEditingOrMovingNote = false;
            isEditingText = false;
            window.scrollTo(0, 0);
            document.body.style.zoom=1.0;
            //note.querySelector('.ql-toolbar').style.display="none";
        });
    }

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
    *   Note Interactions   *
*/

// Drag functionality for notes is noe in event handlers


// Color picker for sticky note background
function changeNoteColor(noteId, color) {
    const note = document.getElementById(noteId);
    var bgCol = hexToRgb(color);
    note.style.borderColor = color;
    note.style.backgroundColor = `rgba(${bgCol.r}, ${bgCol.g}, ${bgCol.b}, 0.1)`;
    //note.style.color = setTextColor(color);
    saveCanvasToLocalStorage();
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
}

/*function setTextColor(bgColor) {
    var r = bgColor.r * 255,
        g = bgColor.g * 255,
        b = bgColor.b * 255;
    var yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return (yiq >= 128) ? '#000' : '#fff';
}*/

// Event handler for notes
function addNoteHandlers(elem) {
    // Save note after each keystroke
    elem.addEventListener('keyup', function (e) {
        saveCanvasToLocalStorage();
    });
    elem.addEventListener('click', function(e) {
        if(!isEditingOrMovingNote) {
            elem.querySelector('.controls').style.display="flex";
        }
    });
    // Initialize inneract
    interact(elem).draggable({
        inertia: true,
        modifiers: [
            interact.modifiers.restrict({
                //restriction: 'parent', // Restrict drag to parent container
                endOnly: true
            })
        ],
        listeners: {
            move(event) {
                if(isEditingText) return;

                isEditingOrMovingNote = true;

                const target = event.target;
                // Calculate the new left and top positions
                const deltaX = event.dx;
                const deltaY = event.dy;

                // Get the starting position from the data attributes set during 'start'
                const startX = parseFloat(target.getAttribute('startX')) || target.style.left;
                const startY = parseFloat(target.getAttribute('startY'))|| target.style.top;

                // Apply the updated position to the element's left and top
                target.style.left = `${startX + deltaX}px`;
                target.style.top = `${startY + deltaY}px`;

                // Update the dataset to ensure smooth continuation of the drag operation
                target.setAttribute('startX', startX + deltaX);
                target.setAttribute('startY', startY + deltaY);

                saveCanvasToLocalStorage();  // Save position to localStorage
            },
            end(event) {
                isEditingOrMovingNote = false;
            }
        }
    });
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if(!isTouchDevice) {
        interact(elem).resizable({
            edges: { left: false, right: true, bottom: true, top: false },
            listeners: {
                move(event) {
                    
                    if(isEditingText) return;
                    
                    isEditingOrMovingNote = true;
    
                    const target = event.target;
                    let { width, height } = event.rect;
    
                    // Apply the new size
                    target.style.width = `${width}px`;
                    target.style.height = `${height}px`;
    
                    // Update width and height attributes for persistence
                    target.setAttribute('data-width', width);
                    target.setAttribute('data-height', height);
    
                    saveCanvasToLocalStorage();  // Save size to localStorage
                },
                end(event) {
                    isEditingOrMovingNote = false;
                }
            },
            modifiers: [
                interact.modifiers.restrictSize({
                    min: { width: 250, height: 150 },
                    max: { width: 800, height: 600 }
                })
            ],
            inertia: true
        });
    }
}

/*
    *   Canvas Zooming and Panning    *
*/

let scale = 1;
let translateX = 0, translateY = 0; // Initial pan offsets from center
let isPanning = false;
let isEditingOrMovingNote = false; // flag to disable pan/zoom during note interactions
let isEditingText = false; // flag to disable pan/zoom during note editing
let startX, startY;
let startTouchX, startTouchY;
let startDistance = 0;

// Get the canvas and container elements
const canvasWrapper = document.querySelector(".canvas-wrapper");
const container = document.getElementById("container");

// Apply the transform (translation and scaling)
function applyTransform() {
    container.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`;
    window.scrollTo(0, 0);
    document.body.style.zoom=1.0;
    saveCanvasToLocalStorage();
}

// Prevent panning and zooming when notes are edited or dragged
document.addEventListener("mousedown", function(e) {
    // If the target is inside a note, disable panning
    if (e.target.closest(".note")) {
        isEditingOrMovingNote = true;
    } else {
        // If target is outside note, hide note controls
        document.querySelectorAll('.note .controls').forEach(function(elem) {
            elem.style.display = "none";
            elem.parentNode.querySelector('.ql-toolbar').style.display="none";
        });
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
/*canvasWrapper.addEventListener('wheel', function(e) {
    if (isEditingOrMovingNote || !currentCanvas) return; // Disable zoom if interacting with a note or there is no canvas active

    const zoomFactor = -0.003;
    // Get the mouse position relative to the container
    const rect = canvasWrapper.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / scale;
    const mouseY = (e.clientY - rect.top) / scale;

    // Adjust scale
    if (e.deltaY > 0) {
        scale = Math.max(0.3, scale - zoomFactor); // Zoom out
    } else {
        scale = Math.min(3, scale + zoomFactor); // Zoom in
    }

    // Calculate the new translation values to zoom around the mouse position
    translateX -= (mouseX * zoomFactor * (e.deltaY > 0 ? 1 : -1));
    translateY -= (mouseY * zoomFactor * (e.deltaY > 0 ? 1 : -1));

    applyTransform();
});*/

// Touch-based panning and pinch-to-zoom
canvasWrapper.addEventListener("touchstart", function(e) {
    if (isEditingOrMovingNote || !currentCanvas) return; // Disable pan/zoom if interacting with a note or there is no canvas active

    if (e.touches.length === 2) {
        // Pinch-to-zoom
        //startDistance = getDistance(e.touches[0], e.touches[1]);
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

    const pinchScaleFactor = 0.002; // Adjusted for smoother pinch-zoom

    if (e.touches.length === 2) {
        // Handle pinch-to-zoom
        /*e.preventDefault();

        const newDistance = getDistance(e.touches[0], e.touches[1]);
        const pinchScale = newDistance / startDistance;
        scale = Math.min(3, Math.max(0.3, scale * pinchScale * ( pinchScaleFactor))); // Restrict zoom levels
        applyTransform();

        startDistance = newDistance; // Update for the next move*/


    } else if (e.touches.length === 1 && isPanning) {
        // Handle panning with single finger
        e.preventDefault();
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
    //return Math.sqrt(dx * dx + dy * dy);
    return Math.hypot(dx, dy);
}

/*
    *   Canvas Title Editing/Renaming    *
*/
document.getElementById("canvasTitle").addEventListener('dblclick', function(e) {
    e.preventDefault();
    if(currentCanvas) {
        this.contentEditable=true;
        this.focus();
    }
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
    // restrict "unsafe" keys in canvas title
    if((titleRestrictedKeys.includes(e.key) && e.target.tagName.toLowerCase() == "h1")) {
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

interact(canvasWrapper)
.gesturable({
    listeners: {
      move (event) {
        // Calculate the new scale by multiplying the event.scale with the initial scale
        let newScale = scale * event.scale;

        // Constrain the scale to a reasonable range
        newScale = Math.max(0.3, Math.min(3.0, newScale));

        // Update the global scale variable
        scale = newScale;

        applyTransform();
      }
    }
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
