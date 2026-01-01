// Paint Editor for Model Editing

let paintCanvas, paintContext, paintError;
let paintGrid = []; // 2D array representing the paint grid
let paintScaleFactor = 1;
let isDrawing = false;
let lastPaintX = -1;
let lastPaintY = -1;

function initPaintEditor() {
	paintCanvas = document.getElementById("paint-canvas");
	paintContext = paintCanvas.getContext("2d");
	paintError = document.getElementById("paint-error");
	
	// Prevent context menu on right click
	paintCanvas.addEventListener("contextmenu", e => e.preventDefault());
	
	// Mouse events
	paintCanvas.addEventListener("mousedown", handlePaintStart);
	paintCanvas.addEventListener("mousemove", handlePaintMove);
	paintCanvas.addEventListener("mouseup", handlePaintEnd);
	paintCanvas.addEventListener("mouseleave", handlePaintEnd);
	
	// Touch events
	paintCanvas.addEventListener("touchstart", handlePaintStart);
	paintCanvas.addEventListener("touchmove", handlePaintMove);
	paintCanvas.addEventListener("touchend", handlePaintEnd);
}

function parseTextareaToGrid(text) {
	const lines = text.split("\n");
	const lineCount = lines.length;
	let longestLineLength = 0;
	
	// Find longest line
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.length > longestLineLength) {
			longestLineLength = line.length;
		}
	}
	
	const gridSize = Math.max(lineCount, longestLineLength);
	
	// Check for invalid characters
	for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
		const line = lines[lineIdx];
		for (let colIdx = 0; colIdx < line.length; colIdx++) {
			const char = line[colIdx];
			if (char !== '0' && char !== '1' && char !== '?') {
				return {
					error: `line ${lineIdx + 1}, column ${colIdx + 1}: Invalid character "${char}"`
				};
			}
		}
	}
	
	// Build grid
	const grid = [];
	for (let y = 0; y < gridSize; y++) {
		const row = [];
		const line = lines[y] || "";
		for (let x = 0; x < gridSize; x++) {
			if (y >= lines.length || x >= line.length) {
				row.push('?'); // Missing pixel
			} else {
				row.push(line[x]);
			}
		}
		grid.push(row);
	}
	
	return { grid, gridSize };
}

function gridToTextarea(grid) {
	return grid.map(row => row.join("")).join("\n");
}

function cleanTrailingQuestionMarks(text) {
	const lines = text.split("\n");
	if (lines.length === 0) return text;
	
	// Find max line length
	let maxLen = 0;
	for (const line of lines) {
		if (line.length > maxLen) maxLen = line.length;
	}
	
	// Pad all lines to same length
	for (let i = 0; i < lines.length; i++) {
		lines[i] = lines[i].padEnd(maxLen, '?');
	}
	
	// Remove any row that contains only "?"
	let filteredLines = lines.filter(line => {
		return line.replace(/[?]/g, "").length > 0;
	});
	
	if (filteredLines.length === 0) return "";
	
	// Update maxLen after filtering rows
	maxLen = filteredLines[0].length;
	
	// Remove any column that contains only "?"
	let colsToRemove = [];
	for (let col = 0; col < maxLen; col++) {
		let onlyQuestions = true;
		for (let row = 0; row < filteredLines.length; row++) {
			if (filteredLines[row][col] !== '?') {
				onlyQuestions = false;
				break;
			}
		}
		if (onlyQuestions) {
			colsToRemove.push(col);
		}
	}
	
	// Remove columns in reverse order
	for (let i = colsToRemove.length - 1; i >= 0; i--) {
		const col = colsToRemove[i];
		for (let row = 0; row < filteredLines.length; row++) {
			filteredLines[row] = filteredLines[row].substring(0, col) + filteredLines[row].substring(col + 1);
		}
	}
	
	return filteredLines.join("\n");
}

function updatePaintFromTextarea() {
	let text = defaultModelTextarea.value;
	
	// Clean trailing question marks
	const cleanedText = cleanTrailingQuestionMarks(text);
	if (cleanedText !== text) {
		defaultModelTextarea.value = cleanedText;
		text = cleanedText;
	}
	
	const result = parseTextareaToGrid(text);
	
	if (result.error) {
		// Show error message
		paintCanvas.style.display = "none";
		paintError.style.display = "block";
		paintError.textContent = result.error;
		applyButton.disabled = true;
		return;
	}
	
	// Hide error, show canvas
	paintCanvas.style.display = "block";
	paintError.style.display = "none";
	
	paintGrid = result.grid;
	
	// Check if valid for Apply button (square and only 0s and 1s)
	const gridSize = result.gridSize;
	let isValid = true;
	for (let y = 0; y < gridSize; y++) {
		for (let x = 0; x < gridSize; x++) {
			if (paintGrid[y][x] === '?') {
				isValid = false;
				break;
			}
		}
		if (!isValid) break;
	}
	applyButton.disabled = !isValid;
	
	updatePaintCanvasSize();
	drawPaintCanvas();
}

function updatePaintCanvasSize() {
	const container = document.getElementById("editor-right");
	const gridSize = paintGrid.length;
	
	const widthRatio = container.clientWidth / gridSize;
	const heightRatio = container.clientHeight / gridSize;
	
	const wPow = Math.floor(Math.log2(widthRatio));
	const hPow = Math.floor(Math.log2(heightRatio));
	
	paintScaleFactor = Math.pow(2, Math.min(wPow, hPow));
	
	const size = gridSize * paintScaleFactor;
	paintCanvas.width = size;
	paintCanvas.height = size;
}

function drawPaintCanvas() {
	paintContext.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
	
	const gridSize = paintGrid.length;
	const cellSize = paintScaleFactor;
	
	// Draw cells
	for (let y = 0; y < gridSize; y++) {
		for (let x = 0; x < gridSize; x++) {
			const value = paintGrid[y][x];
			let color;
			
			if (value === '0') {
				color = 'black';
			} else if (value === '1') {
				color = 'white';
			} else { // '?'
				color = 'red';
			}
			
			paintContext.fillStyle = color;
			paintContext.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
		}
	}
	
	// Draw grid lines
	paintContext.strokeStyle = 'rgba(128, 128, 128, 0.5)';
	paintContext.lineWidth = 1;
	
	// Vertical lines
	for (let x = 0; x <= gridSize; x++) {
		paintContext.beginPath();
		paintContext.moveTo(x * cellSize, 0);
		paintContext.lineTo(x * cellSize, gridSize * cellSize);
		paintContext.stroke();
	}
	
	// Horizontal lines
	for (let y = 0; y <= gridSize; y++) {
		paintContext.beginPath();
		paintContext.moveTo(0, y * cellSize);
		paintContext.lineTo(gridSize * cellSize, y * cellSize);
		paintContext.stroke();
	}
}

function getPaintColor(event) {
	const selectedRadio = document.querySelector('input[name="paint-color"]:checked');
	return selectedRadio ? selectedRadio.value : '0';
}

function getPaintCoordinates(event) {
	const rect = paintCanvas.getBoundingClientRect();
	let clientX, clientY;
	
	if (event.touches && event.touches.length > 0) {
		clientX = event.touches[0].clientX;
		clientY = event.touches[0].clientY;
	} else {
		clientX = event.clientX;
		clientY = event.clientY;
	}
	
	const x = Math.floor((clientX - rect.left) / paintScaleFactor);
	const y = Math.floor((clientY - rect.top) / paintScaleFactor);
	
	return { x, y };
}

function paintPixel(x, y, color) {
	if (x >= 0 && x < paintGrid[0].length && y >= 0 && y < paintGrid.length) {
		paintGrid[y][x] = color;
		
		// Draw immediately
		const cellSize = paintScaleFactor;
		let fillColor;
		if (color === '0') {
			fillColor = 'black';
		} else if (color === '1') {
			fillColor = 'white';
		} else { // '?'
			fillColor = 'red';
		}
		
		paintContext.fillStyle = fillColor;
		paintContext.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
		
		// Redraw grid lines for this cell
		paintContext.strokeStyle = 'rgba(128, 128, 128, 0.5)';
		paintContext.lineWidth = 1;
		paintContext.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
	}
}

function paintLine(x0, y0, x1, y1, color) {
	// Bresenham's line algorithm to paint all pixels between two points
	const dx = Math.abs(x1 - x0);
	const dy = Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let err = dx - dy;
	
	while (true) {
		paintPixel(x0, y0, color);
		
		if (x0 === x1 && y0 === y1) break;
		
		const e2 = 2 * err;
		if (e2 > -dy) {
			err -= dy;
			x0 += sx;
		}
		if (e2 < dx) {
			err += dx;
			y0 += sy;
		}
	}
}

function handlePaintStart(event) {
	event.preventDefault();
	isDrawing = true;
	
	const coords = getPaintCoordinates(event);
	const color = getPaintColor(event);
	
	paintPixel(coords.x, coords.y, color);
	lastPaintX = coords.x;
	lastPaintY = coords.y;
}

function handlePaintMove(event) {
	if (!isDrawing) return;
	event.preventDefault();
	
	const coords = getPaintCoordinates(event);
	const color = getPaintColor(event);
	
	if (lastPaintX !== -1 && lastPaintY !== -1) {
		paintLine(lastPaintX, lastPaintY, coords.x, coords.y, color);
	} else {
		paintPixel(coords.x, coords.y, color);
	}
	
	lastPaintX = coords.x;
	lastPaintY = coords.y;
}

function handlePaintEnd(event) {
	if (!isDrawing) return;
	isDrawing = false;
	lastPaintX = -1;
	lastPaintY = -1;
	
	// Sync paint -> text
	defaultModelTextarea.value = gridToTextarea(paintGrid);
	updatePaintFromTextarea(); // Re-validate
}