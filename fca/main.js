function getRule(ruleId, nofInputs) {
	const nofLines = Math.pow(2, nofInputs);
	const emptyLines = [...new Array(nofLines)];
	const keys = emptyLines
		.map((v, i) => i.toString(2)
			.padStart(nofInputs)
			.replaceAll(" ", "0"));
	const values = (ruleId >>> 0)
		.toString(2)
		.padStart(nofLines)
		.replaceAll(" ", "0")
		.split("")
		.reverse() // before: [0] is the MSB ; after: [0] is the LSB
		.map(d => d >>> 0);

	const rule = {};
	emptyLines.forEach((v, i) => {
		const key = keys[i];
		const value = values[i];
		rule[key] = value;
	});
	return rule;
}

function getRuleIdFromUrlParams() {
	const queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	if (!urlParams.has("ruleId")) {
		return undefined;
	}

	const ruleId = urlParams.get("ruleId");
	if (!/^\d+$/.test(ruleId)) {
		return undefined;
	}
	if (ruleId >= Math.pow(2, Math.pow(2, 4))) {
		return undefined;
	}

	return ruleId;
}

function getValue(model, x, y) {
	const size = model.length;
	if (x < 0) {
		x = 0;
	} else if (x > size - 1) {
		x = size - 1;
	}

	if (y < 0) {
		y = 0;
	} else if (y > size - 1) {
		y = size - 1;
	}

	return model[x][y];
}

function setValue(model, x, y, value) {
	model[x][y] = value;
}

function drawModel() {
	mainContext.clearRect(0, 0, mainContext.width, mainContext.height);

	for (let y = 0; y < model.length; ++y) {
		for (let x = 0; x < model.length; ++x) {
			const value = getValue(model, x, y);
			const color = convertValueToColor(value);

			mainContext.fillStyle = color;
			mainContext.fillRect(x * displayScaleFactor, y * displayScaleFactor, displayScaleFactor, displayScaleFactor);
		}
	}
}

function updateDisplayScaleFactorAndCanvasSize() {
	const widthRatio = layers.clientWidth / model.length;
	const heightRatio = layers.clientHeight / model.length;

	const wPow = Math.floor(Math.log2(widthRatio));
	const hPow = Math.floor(Math.log2(heightRatio));

	displayScaleFactor = Math.pow(2, Math.min(wPow, hPow));

	const size = model.length * displayScaleFactor;
	[zoomCanvas, mainCanvas].forEach(canvas => {
		canvas.width = size;
		canvas.height = size;
	});
}

function getViewBox(x, y, size, maxXYMax) {
	const halfSize = size / 2; // because we want to center, if possible, the box on the (x, y) point
	x -= halfSize;
	y -= halfSize;

	if (x < 0) {
		x = 0;
	} else if (x + size > maxXYMax) {
		x = maxXYMax - size;
	}

	if (y < 0) {
		y = 0;
	} else if (y + size > maxXYMax) {
		y = maxXYMax - size;
	}

	return {
		min: { x: x, y: y },
		max: { x: x + size, y: y + size },
	};
}

function drawNextZoomArea(event) {
	const imgDisplaySize = displayScaleFactor * model.length;

	zoomContext.clearRect(0, 0, imgDisplaySize, imgDisplaySize);
	if (displayScaleFactor > 1) {
		zoomContext.strokeRect(0, 0, imgDisplaySize, imgDisplaySize);
		return;
	}

	const zoomAreaSize = imgDisplaySize / 2; // because the zoom factor is 2
	const rect = event.target.getBoundingClientRect();
	const x = (event.clientX - rect.left) >>> 0;
	const y = (event.clientY - rect.top) >>> 0;
	const viewBox = getViewBox(x, y, zoomAreaSize, imgDisplaySize);

	zoomContext.strokeStyle = 'red';
	zoomContext.strokeRect(viewBox.min.x, viewBox.min.y, zoomAreaSize, zoomAreaSize);
}

function convertValueToColor(value) {
	return value == 1
		? "white"
		: "black";
}

function computeValue(model, x, y, rule, inputs) {
	const key = inputs.join("");
	const value = rule[key];
	setValue(model, x, y, value);
}

function generateNextModel(currentModel, viewBox) {
	ruleId = ruleIdTextField.value;
	const rule = getRule(ruleId, 4);

	const modelSize = currentModel.length;
	let nextModelSize;
	if (viewBox === undefined) {
		viewBox = {
			min: { x: 0, y: 0 },
			max: { x: modelSize - 1, y: modelSize - 1 },
		};
		nextModelSize = modelSize * 2;
	} else {
		nextModelSize = modelSize; // modelSize * 2 (zoomming) / 2 (cropping)
	}

	const nextModel = [...new Array(nextModelSize)]
		.map(a => new Array(nextModelSize));

	for (let y = 0, yMax = nextModelSize; y < yMax; y += 2) {
		const yp = y / 2 + viewBox.min.y;
		for (let x = 0, xMax = nextModelSize; x < xMax; x += 2) {
			const xp = x / 2 + viewBox.min.x;
			/*
			*          xp-1  xp  xp+1
			*
			*         +----+----+----+
			* yp-1    | v7 | v8 | v9 |
			*         +----+----+----+
			* yp      | v4 | v5 | v6 |
			*         +----+----+----+
			* yp+1    | v1 | v2 | v3 |
			*         +----+----+----+
			*/
			const v1 = getValue(currentModel, xp - 1, yp + 1);
			const v2 = getValue(currentModel, xp + 0, yp + 1);
			const v3 = getValue(currentModel, xp + 1, yp + 1);
			const v4 = getValue(currentModel, xp - 1, yp + 0);
			const v5 = getValue(currentModel, xp + 0, yp + 0);
			const v6 = getValue(currentModel, xp + 1, yp + 0);
			const v7 = getValue(currentModel, xp - 1, yp - 1);
			const v8 = getValue(currentModel, xp + 0, yp - 1);
			const v9 = getValue(currentModel, xp + 1, yp - 1);


			/* current model      =>     next model
			*                                     +---+---+
			*           +----+                    | a | b |
			*  any cell | v5 |  becomes  4 cells  +---+---+
			*           +----+                    | c | d |
			*                                     +---+---+
			*/

			/* input selection
			* +--------------+--------------+--------------+
			* |              |              |              |
			* |     (v7)     |     (v8)     |     (v9)     |
			* |        a[2]  |  a[1]  b[3]  |  b[2]        |
			* +--------------+--------------+--------------+
			* |        a[3]  |  a[0]  b[0]  |  b[1]        |
			* |     (v4)     |     (v5)     |     (v6)     |
			* |        c[1]  |  c[0]  d[0]  |  d[3]        |
			* +--------------+--------------+--------------+
			* |        c[2]  |  c[3]  d[1]  |  d[2]        |
			* |     (v1)     |     (v2)     |     (v3)     |
			* |              |              |              |
			* +--------------+--------------+--------------+
			*/
			const a = {
				cell: { x: x + 0, y: y + 0 },
				inputs: [v5, v8, v7, v4],
			};
			const b = {
				cell: { x: x + 1, y: y + 0 },
				inputs: [v5, v6, v9, v8],
			};
			const c = {
				cell: { x: x + 0, y: y + 1 },
				inputs: [v5, v4, v1, v2],
			};
			const d = {
				cell: { x: x + 1, y: y + 1 },
				inputs: [v5, v2, v3, v6],
			};

			[a, b, c, d].forEach(o => {
				computeValue(nextModel, o.cell.x, o.cell.y, rule, o.inputs);
			});
		}
	}

	return nextModel;
}

function transpose(matrix) {
	const firstRow = matrix[0];
	return firstRow.map((unusedValue, columnIndex) => matrix.map(row => row[columnIndex]));
}


let ruleId = getRuleIdFromUrlParams();
if (ruleId === undefined) {
	ruleId = 1385;
}
const ruleIdTextField = document.getElementById("ruleId");
ruleIdTextField.value = ruleId;
ruleIdTextField.min = 0;
ruleIdTextField.max = Math.pow(2, Math.pow(2, 4)) - 1;

let defaultModel = transpose([
	[0, 0, 0],
	[0, 1, 0],
	[0, 0, 0],
]);

const defaultModelTextarea = document.getElementById("default-model");
defaultModelTextarea.value = transpose(defaultModel).map(row => row.join("")).join("\n");

let model = defaultModel;

const mainCanvas = document.getElementById("main");
const mainContext = mainCanvas.getContext("2d");
const zoomCanvas = document.getElementById("zoom");
const zoomContext = zoomCanvas.getContext("2d");
const layers = document.getElementById("layers");

const initialImage = new Image();

let displayScaleFactor = 1;

// To zoom
const clickToZoom = event => {
	if (displayScaleFactor > 1) {
		model = generateNextModel(model);
	} else {
		const rect = event.target.getBoundingClientRect();
		const x = (event.clientX - rect.left) >>> 0;
		const y = (event.clientY - rect.top) >>> 0;
		const viewBox = getViewBox(x, y, model.length / 2, model.length);
		model = generateNextModel(model, viewBox);
	}
	updateDisplayScaleFactorAndCanvasSize();
	drawModel();
	drawNextZoomArea(event);
};
mainCanvas.addEventListener("click", clickToZoom);

document.getElementById("share-ruleId").addEventListener("click", event => {
	prompt("URL", window.location.href.replace(/[?].*/, "") + "?ruleId=" + ruleId);
	event.stopPropagation();
});
document.getElementById("td-for-ruleId").addEventListener("click", event => {
	ruleIdTextField.focus();
});

const tdForSzaCheckbox = document.getElementById("td-for-sza-checkbox");
if ("ontouchstart" in window ||
		navigator.msMaxTouchPoints) {
	// This is a touch device.
	// Then there is no useful mouse over.
	// Then we disable the show zoom area, and remove the checkbox.
	tdForSzaCheckbox.remove();
	zoomCanvas.style.display = "none";
} else {
	// To show the next zoom area
	zoomCanvas.addEventListener("mousemove", event => {
		window.requestAnimationFrame(() => {
			drawNextZoomArea(event);
		});
	});

	zoomCanvas.addEventListener("click", clickToZoom);

	const showZoomAreaCheckbox = document.getElementById("show-zoom-area");
	// Since a label for the checkbox would not receive clicks in the padding area,
	// the td is listening for clicks and gives untrusted click to the checkbox.
	tdForSzaCheckbox.addEventListener("click", event => {
		showZoomAreaCheckbox.dispatchEvent(new Event("click"));
	});
	showZoomAreaCheckbox.addEventListener("click", event => {
		if (event.isTrusted === true) {
			// real click => ignored (only treat the click events built by the listener on the td)
			event.stopImmediatePropagation();
			return false;
		}
		showZoomAreaCheckbox.checked = !showZoomAreaCheckbox.checked;
		zoomCanvas.style.display = showZoomAreaCheckbox.checked
			? "block"
			: "none";
	});
}

document.getElementById("td-for-reset").addEventListener("click", event => {
	layers.style.display = "block";
	defaultModelTextarea.style.display = "none";

	const m = defaultModelTextarea.value
		.split("\n")
		.map(line => {
			const rowStr = line.replace(/[^01]/g, "");
			return rowStr.length === 0
				? null
				: rowStr.split(/(?=[01])/);
		})
		.filter(row => row !== null);
	const nofColumnsSet = new Set(m.map(row => row.length));
	const nofRows = m.length;
	const nofNofColumns = nofColumnsSet.size;
	const nofColumns = [...nofColumnsSet][0];

	if (nofNofColumns === 1 &&
			nofRows === nofColumns &&
			nofRows >= 2) {
		// save it and use it
		defaultModel = transpose(m);
		model = defaultModel;
	} else {
		console.log("new default model rejected:", nofNofColumns === 1
			? {
				"nofColumns": nofColumns,
				"nofRows": nofRows,
			}
			: {
				"nofColumnsSet": nofColumnsSet,
				"nofNofColumns": nofNofColumns,
			});
		model = defaultModel;
	}
	updateDisplayScaleFactorAndCanvasSize();
	drawModel();
});

document.getElementById("td-for-edit").addEventListener("click", event => {
	layers.style.display = "none";
	defaultModelTextarea.style.display = "block";
});

updateDisplayScaleFactorAndCanvasSize();
drawModel();