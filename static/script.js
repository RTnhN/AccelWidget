class AccelSimulator {
    constructor() {
    // DOM elements
    this.containerAccel = document.getElementById('accelcontainer');
    this.canvasAccel = document.getElementById('canvasAccel');
    this.ctxAccel = this.canvasAccel.getContext('2d');
    this.capacitanceDiv = document.getElementById('capacitance');
    this.accelDiv = document.getElementById('accel');

    // Device frame parameters
    this.frameWidth = 200;
    this.frameHeight = 200;

    // Initial canvas sizing
    this.resizeCanvasAccel();

    // Device and proof mass state
    this.deviceX = this.canvasAccel.width / 2;
    this.deviceY = this.canvasAccel.height / 2;
    this.previousDeviceX = this.deviceX;
    this.fixedSensorMargin = 10;
    this.fixedFingerWidth = 10;
    this.fixedFingerHeight = 50;

    // Proof mass parameters
    this.massX = this.deviceX;
    this.massY = this.deviceY;
    this.massWidth = 80;
    this.massHeight = 60;
    this.massVelX = 0;

    // Spring damper simulation parameters
    this.springK = 5;       // spring constant
    this.damping = 2;       // damping coefficient
    this.massValue = 0.1;
    this.maxDisplacement = 30;

    // Simulation variables
    this.dx = 0;
    this.accel = 0;
    this.capacitance = 0;
    this.accel_scaler = 24000;
    this.printAccel = 0;
    this.lastInteractionTime = Date.now();
    this.dragging = false;
    this.dragOffsetX = 0;
    this.atStart = true;

    // Time variables for animation
    this.startTime = Date.now();
    this.lastFrameTime = Date.now();

    // Initialize Plotly acceleration data
    this.accelerationData = [{
        x: [],
        y: [],
        mode: 'lines',
        type: 'scatter',
        line: { shape: 'spline' }
    }];
    this.accelerationLayout = {
        title: 'Acceleration over Time',
        xaxis: { title: 'Time (s)' },
        yaxis: { title: 'Acceleration' },
        margin: { t: 40, b: 40 }
    };
    Plotly.newPlot('accelerationPlot', this.accelerationData, this.accelerationLayout, { 'displayModeBar': false });

    // Bind the event handlers
    this.setupEventListeners();
    }

    // Adjust canvas size based on container dimensions (reserve 300px for Plotly plot)
    resizeCanvasAccel() {
    this.canvasAccel.width = this.containerAccel.clientWidth;
    this.canvasAccel.height = this.containerAccel.clientHeight - 300;
    }

    // Update the last time the user interacted with the canvas
    updateInteractionTime() {
    this.lastInteractionTime = Date.now();
    }

    // --- Event Handlers ---
    handleMouseDown(e) {
    this.updateInteractionTime();
    const rect = this.canvasAccel.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (
        mouseX >= this.deviceX - this.frameWidth / 2 - 50 &&
        mouseX <= this.deviceX + this.frameWidth / 2 + 50 &&
        mouseY >= this.deviceY - this.frameHeight / 2 - 50 &&
        mouseY <= this.deviceY + this.frameHeight / 2 + 50
    ) {
        this.dragging = true;
        this.dragOffsetX = mouseX - this.deviceX;
    }
    }

    handleMouseMove(e) {
    if (this.dragging) {
        if (this.atStart) {
        requestAnimationFrame(() => this.animate());
        }
        this.updateInteractionTime();
        const rect = this.canvasAccel.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        this.deviceX = mouseX - this.dragOffsetX;
        this.atStart = false;
    }
    }

    handleMouseUp() {
    this.dragging = false;
    }

    handleTouchStart(e) {
    this.updateInteractionTime();
    const touch = e.touches[0];
    const rect = this.canvasAccel.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    if (
        touchX >= this.deviceX - this.frameWidth / 2 - 50 &&
        touchX <= this.deviceX + this.frameWidth / 2 + 50 &&
        touchY >= this.deviceY - this.frameHeight / 2 - 50 &&
        touchY <= this.deviceY + this.frameHeight / 2 + 50
    ) {
        this.dragging = true;
        this.dragOffsetX = touchX - this.deviceX;
    }
    e.preventDefault();
    }

    handleTouchMove(e) {
    if (this.dragging) {
        if (this.atStart) {
        requestAnimationFrame(() => this.animate());
        }
        this.updateInteractionTime();
        const touch = e.touches[0];
        const rect = this.canvasAccel.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        this.deviceX = touchX - this.dragOffsetX;
        this.atStart = false;
    }
    e.preventDefault();
    }

    handleTouchEnd() {
    this.dragging = false;
    }

    setupEventListeners() {
    // Window resize event
    window.addEventListener('resize', () => {
        this.resizeCanvasAccel();
        this.deviceX = this.canvasAccel.width / 2;
        this.massX = this.deviceX;
        this.renderAccel();
    });

    // Mouse events
    this.canvasAccel.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvasAccel.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvasAccel.addEventListener('mouseup', () => this.handleMouseUp());

    // Touch events
    this.canvasAccel.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvasAccel.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvasAccel.addEventListener('touchend', () => this.handleTouchEnd());
    }

    // --- Drawing and Simulation Functions ---
    drawSpring(x1, y1, x2, y2) {
    const segments = 20;
    const amplitude = 10;
    this.ctxAccel.beginPath();
    this.ctxAccel.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + amplitude * Math.sin(t * Math.PI * 4);
        this.ctxAccel.lineTo(x, y);
    }
    this.ctxAccel.lineTo(x2, y2);
    this.ctxAccel.stroke();
    }

    updatePhysics(dt) {
    // Calculate device velocity (finite difference approximation)
    const deviceVelX = (this.deviceX - this.previousDeviceX) / dt;
    this.previousDeviceX = this.deviceX;

    // Compute relative displacement (dx) between mass and device frame
    this.dx = this.massX - this.deviceX;

    // Clamp dx to a maximum value to avoid excessive forces
    if (Math.abs(this.dx) > this.maxDisplacement) {
        this.dx = Math.sign(this.dx) * this.maxDisplacement;
        this.massX = this.deviceX + this.dx;
        this.massVelX = deviceVelX;
    }

    // Calculate forces: spring force and damping force based on relative velocity
    const springForce = -this.springK * this.dx;
    const dampingForce = -this.damping * (this.massVelX - deviceVelX);
    const totalForce = springForce + dampingForce;

    // Update acceleration, velocity, and mass position (Euler integration)
    this.accel = totalForce / this.massValue;
    this.massVelX += this.accel * dt;
    this.massX += this.massVelX * dt;

    this.printAccel = this.accel / this.accel_scaler * 16;
    this.printAccel = Math.abs(this.printAccel) < 0.001 ? 0 : this.printAccel;

    // Update info display
    this.capacitance = 200 / (30 + 2 - Math.abs(this.dx));
    this.capacitanceDiv.textContent = this.capacitance.toFixed(2);
    this.accelDiv.textContent = this.printAccel.toFixed(2);

    const numberOfPoints = 100;
    const currentTime = (Date.now() - this.startTime) / 1000;

    if (!this.dragging && Date.now() - this.lastInteractionTime >= 5000 && !this.atStart) {
        this.deviceX = this.canvasAccel.width / 2;
        this.massX = this.canvasAccel.width / 2;
        this.massVelX = 0;
        this.accelerationData[0].x = [];
        this.accelerationData[0].y = [];
        Plotly.react('accelerationPlot', this.accelerationData, this.accelerationLayout);
        this.updateInteractionTime();
        this.atStart = true;
    }
    if (!this.atStart) {
        Plotly.extendTraces('accelerationPlot', {
        x: [[currentTime]],
        y: [[this.printAccel]]
        }, [0], numberOfPoints);
        this.renderAccel();
    }
    }

    renderAccel() {
    this.ctxAccel.clearRect(0, 0, this.canvasAccel.width, this.canvasAccel.height);

    // Draw device frame
    const frameLeft = this.deviceX - this.frameWidth / 2;
    const frameTop = this.deviceY - this.frameHeight / 2;
    this.ctxAccel.strokeStyle = '#333';
    this.ctxAccel.lineWidth = 30;
    this.ctxAccel.strokeRect(frameLeft, frameTop, this.frameWidth, this.frameHeight);

    // Draw the mass
    const massTop = this.massY - this.massHeight / 2;
    const massLeft = this.massX - this.massWidth / 2;

    // Draw fixed sensors (one finger per side)
    const fixedFingerX = frameLeft + this.frameWidth / 2 - this.fixedFingerWidth / 2;
    this.ctxAccel.fillStyle = '#333';
    const topFixedY = frameTop + this.fixedSensorMargin;
    this.ctxAccel.fillRect(fixedFingerX, topFixedY, this.fixedFingerWidth, this.fixedFingerHeight);
    const bottomFixedY = frameTop + this.frameHeight - this.fixedSensorMargin - this.fixedFingerHeight;
    this.ctxAccel.fillRect(fixedFingerX, bottomFixedY, this.fixedFingerWidth, this.fixedFingerHeight);

    // Draw instruction text in the frame
    this.ctxAccel.save();
    this.ctxAccel.translate(this.deviceX, this.deviceY);
    this.ctxAccel.fillStyle = '#aaa';
    this.ctxAccel.font = 'bold 18px sans-serif';
    this.ctxAccel.textAlign = 'center';
    this.ctxAccel.fillText('Click and Drag Here', 0, this.frameHeight / 2 + 5);
    this.ctxAccel.fillText('Click and Drag Here', 0, -this.frameHeight / 2 + 5);
    this.ctxAccel.restore();
    this.ctxAccel.fillStyle = '#333';

    // Draw springs from frame to mass
    const springLeftStartX = frameLeft + this.fixedSensorMargin;
    const springLeftY = massTop + this.massHeight / 2;
    const massLeftEdge = massLeft;

    const springRightStartX = frameLeft + this.frameWidth - this.fixedSensorMargin;
    const springRightY = massTop + this.massHeight / 2;
    const massRightEdge = massLeft + this.massWidth;

    this.ctxAccel.strokeStyle = '#333';
    this.ctxAccel.lineWidth = 2;
    this.drawSpring(springLeftStartX, springLeftY, massLeftEdge, springLeftY);
    this.drawSpring(springRightStartX, springRightY, massRightEdge, springRightY);

    // Draw the proof mass
    this.ctxAccel.fillStyle = '#aaa';
    this.ctxAccel.fillRect(massLeft, massTop, this.massWidth, this.massHeight);

    // Draw mass "fingers"
    const massFingerWidth = 10;
    const massFingerHeight = 50;
    const leftFingerX = massLeft;
    const fingerTopY = massTop - massFingerHeight;
    const fingerBottomY = massTop + this.massHeight;
    this.ctxAccel.fillRect(leftFingerX, fingerTopY, massFingerWidth, massFingerHeight);
    this.ctxAccel.fillRect(leftFingerX, fingerBottomY, massFingerWidth, massFingerHeight);

    const rightFingerX = massLeft + this.massWidth - massFingerWidth;
    this.ctxAccel.fillRect(rightFingerX, fingerTopY, massFingerWidth, massFingerHeight);
    this.ctxAccel.fillRect(rightFingerX, fingerBottomY, massFingerWidth, massFingerHeight);
    }

    animate() {
    const now = Date.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    this.updatePhysics(dt);
    if (!this.atStart) {
        requestAnimationFrame(() => this.animate());
    }
    }
}
