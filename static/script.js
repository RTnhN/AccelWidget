const containerAccel = document.getElementById('accelcontainer');
const canvasAccel = document.getElementById('canvasAccel');
const ctxAccel = canvasAccel.getContext('2d');
const capacitanceDiv = document.getElementById('capacitance');
const accelDiv = document.getElementById('accel');

// Adjust canvas size based on container dimensions (reserve 300px for Plotly plot)
function resizeCanvasAccel() {
    canvasAccel.width = containerAccel.clientWidth;
    canvasAccel.height = containerAccel.clientHeight - 300;
}
resizeCanvasAccel();
window.addEventListener('resize', resizeCanvasAccel);

// Device frame parameters
let deviceX = canvasAccel.width / 2;
const deviceY = canvasAccel.height / 2;
const frameWidth = 200;
const frameHeight = 200;

// For computing device velocity
let previousDeviceX = deviceX;

// Fixed sensor (frame) parameters one finger per side
const fixedSensorMargin = 10;
const fixedFingerWidth = 10;
const fixedFingerHeight = 50;

// Proof mass parameters
let massX = deviceX; // horizontal center of the mass
const massY = deviceY;
const massWidth = 80;
const massHeight = 60;
let massVelX = 0;

// Spring damper simulation parameters
const springK = 5;    // spring constant
const damping = 2;    // damping coefficient (N per (m/s))
const massValue = 0.1;
const maxDisplacement = 30;

let dx = 0;
let accel = 0;
let capacitance = 0;
const accel_scaler = 24000;
let printAccel = 0;

let lastInteractionTime = Date.now();
let dragging = false;
let dragOffsetX = 0;
let atStart = true;

function updateInteractionTime() {
    lastInteractionTime = Date.now();
}

canvasAccel.addEventListener('mousedown', (e) => {
    updateInteractionTime();
    const rect = canvasAccel.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (
        mouseX >= deviceX - frameWidth / 2 - 50 &&
        mouseX <= deviceX + frameWidth / 2 + 50 &&
        mouseY >= deviceY - frameHeight / 2 - 50 &&
        mouseY <= deviceY + frameHeight / 2 + 50
    ) {
        dragging = true;
        dragOffsetX = mouseX - deviceX;
    }
});

canvasAccel.addEventListener('mousemove', (e) => {
    if (dragging) {
        updateInteractionTime();
        const rect = canvasAccel.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        deviceX = mouseX - dragOffsetX;
        atStart = false;
    }
});

canvasAccel.addEventListener('mouseup', () => {
    dragging = false;
});

canvasAccel.addEventListener('touchstart', (e) => {
    updateInteractionTime();
    const touch = e.touches[0];
    const rect = canvasAccel.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    if (
        touchX >= deviceX - frameWidth / 2 - 50 &&
        touchX <= deviceX + frameWidth / 2 + 50 &&
        touchY >= deviceY - frameHeight / 2 - 50 &&
        touchY <= deviceY + frameHeight / 2 + 50
    ) {
        dragging = true;
        dragOffsetX = touchX - deviceX;

    }
    e.preventDefault();
}, { passive: false });

canvasAccel.addEventListener('touchmove', (e) => {
    if (dragging) {
        updateInteractionTime();
        const touch = e.touches[0];
        const rect = canvasAccel.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        deviceX = touchX - dragOffsetX;
        atStart = false;


    }
    e.preventDefault();
}, { passive: false });

canvasAccel.addEventListener('touchend', () => {
    dragging = false;
});

function drawSpring(x1, y1, x2, y2) {
    const segments = 20;
    const amplitude = 10;
    ctxAccel.beginPath();
    ctxAccel.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + amplitude * Math.sin(t * Math.PI * 4);
        ctxAccel.lineTo(x, y);
    }
    ctxAccel.lineTo(x2, y2);
    ctxAccel.stroke();
}

let startTime = Date.now();
let lastFrameTime = Date.now();

// Initialize Plotly acceleration data
var accelerationData = [{
    x: [],
    y: [],
    mode: 'lines',
    type: 'scatter',
    line: { shape: 'spline' }
}];
var accelerationLayout = {
    title: 'Acceleration over Time',
    xaxis: { title: 'Time (s)' },
    yaxis: { title: 'Acceleration' },
    margin: { t: 40, b: 40 }
};
Plotly.newPlot('accelerationPlot', accelerationData, accelerationLayout, {});

function updatePhysics(dt) {
    // Calculate device velocity (finite difference approximation)
    const deviceVelX = (deviceX - previousDeviceX) / dt;
    previousDeviceX = deviceX;

    // Compute relative displacement (dx) between mass and device frame
    dx = massX - deviceX;

    // Clamp dx to a maximum value to avoid excessive forces
    if (Math.abs(dx) > maxDisplacement) {
        dx = Math.sign(dx) * maxDisplacement;
        massX = deviceX + dx;
        massVelX = deviceVelX; // Align mass velocity with device when clamped
    }

    // Calculate forces: spring force and damping force based on relative velocity
    const springForce = -springK * dx;
    const dampingForce = -damping * (massVelX - deviceVelX);
    const totalForce = springForce + dampingForce;

    // Update acceleration, velocity, and mass position (Euler integration)
    accel = totalForce / massValue;
    massVelX += accel * dt;
    massX += massVelX * dt;

    printAccel = accel / accel_scaler * 16;

    printAccel = Math.abs(printAccel) < .001 ? 0 : printAccel

    // Update info display
    capacitance = 200 / (30 + 2 - Math.abs(dx));
    capacitanceDiv.textContent = capacitance.toFixed(2);
    accelDiv.textContent = printAccel.toFixed(2);

    const numberOfPoints = 100;

    const currentTime = (Date.now() - startTime) / 1000;


    if (!dragging && Date.now() - lastInteractionTime >= 5000 && !atStart) {
        deviceX = canvasAccel.width / 2;
        massX = canvasAccel.width / 2;
        massVelX = 0;
        accelerationData[0].x = [];
        accelerationData[0].y = [];
        Plotly.react('accelerationPlot', accelerationData, accelerationLayout);
        updateInteractionTime();
        atStart = true;
    } 
    if (!atStart) {
        Plotly.extendTraces('accelerationPlot', {
            x: [[currentTime]],
            y: [[printAccel]]
        }, [0], numberOfPoints);
        renderAccel();
    }
}

function renderAccel() {
    ctxAccel.clearRect(0, 0, canvasAccel.width, canvasAccel.height);

    const frameLeft = deviceX - frameWidth / 2;
    const frameTop = deviceY - frameHeight / 2;
    ctxAccel.strokeStyle = '#333';
    ctxAccel.lineWidth = 30;
    ctxAccel.strokeRect(frameLeft, frameTop, frameWidth, frameHeight);

    const massTop = massY - massHeight / 2;
    const massLeft = massX - massWidth / 2;

    const fixedFingerX = frameLeft + frameWidth / 2 - fixedFingerWidth / 2;
    ctxAccel.fillStyle = '#333';
    const topFixedY = frameTop + fixedSensorMargin;
    ctxAccel.fillRect(fixedFingerX, topFixedY, fixedFingerWidth, fixedFingerHeight);
    const bottomFixedY = frameTop + frameHeight - fixedSensorMargin - fixedFingerHeight;
    ctxAccel.fillRect(fixedFingerX, bottomFixedY, fixedFingerWidth, fixedFingerHeight);
    ctxAccel.save();
    ctxAccel.translate(deviceX, deviceY);
    ctxAccel.fillStyle = '#aaa';
    ctxAccel.font = 'bold 18px sans-serif';
    ctxAccel.textAlign = 'center';
    ctxAccel.fillText('Click and Drag Here', 0, frameHeight / 2 + 5);
    ctxAccel.fillText('Click and Drag Here', 0, -frameHeight / 2 + 5);
    ctxAccel.restore();
    ctxAccel.fillStyle = '#333';

    const springLeftStartX = frameLeft + fixedSensorMargin;
    const springLeftY = massTop + massHeight / 2;
    const massLeftEdge = massLeft;

    const springRightStartX = frameLeft + frameWidth - fixedSensorMargin;
    const springRightY = massTop + massHeight / 2;
    const massRightEdge = massLeft + massWidth;

    ctxAccel.strokeStyle = '#333';
    ctxAccel.lineWidth = 2;
    drawSpring(springLeftStartX, springLeftY, massLeftEdge, springLeftY);
    drawSpring(springRightStartX, springRightY, massRightEdge, springRightY);

    ctxAccel.fillStyle = '#aaa';
    ctxAccel.fillRect(massLeft, massTop, massWidth, massHeight);

    const massFingerWidth = 10;
    const massFingerHeight = 50;
    const leftFingerX = massLeft;
    const fingerTopY = massTop - massFingerHeight;
    const fingerBottomY = massTop + massHeight;
    ctxAccel.fillRect(leftFingerX, fingerTopY, massFingerWidth, massFingerHeight);
    ctxAccel.fillRect(leftFingerX, fingerBottomY, massFingerWidth, massFingerHeight);

    const rightFingerX = massLeft + massWidth - massFingerWidth;
    ctxAccel.fillRect(rightFingerX, fingerTopY, massFingerWidth, massFingerHeight);
    ctxAccel.fillRect(rightFingerX, fingerBottomY, massFingerWidth, massFingerHeight);
}

function animate() {
    const now = Date.now();
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    updatePhysics(dt);
    requestAnimationFrame(animate);
}
renderAccel();


animate();