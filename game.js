// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Load snake face image
const snakeFaceImage = new Image();
snakeFaceImage.src = 'snakeface.png';

// Create green apple image using canvas
const appleImage = new Image();
const appleCanvas = document.createElement('canvas');
appleCanvas.width = 40;
appleCanvas.height = 40;
const appleCtx = appleCanvas.getContext('2d');

// Draw apple
appleCtx.fillStyle = '#4CAF50'; // Green apple body
appleCtx.beginPath();
appleCtx.arc(20, 22, 15, 0, Math.PI * 2);
appleCtx.fill();

// Apple highlight
appleCtx.fillStyle = '#81C784';
appleCtx.beginPath();
appleCtx.arc(16, 18, 6, 0, Math.PI * 2);
appleCtx.fill();

// Stem
appleCtx.fillStyle = '#795548';
appleCtx.fillRect(18, 6, 4, 8);

// Leaf
appleCtx.fillStyle = '#2E7D32';
appleCtx.beginPath();
appleCtx.ellipse(25, 10, 6, 4, Math.PI / 4, 0, Math.PI * 2);
appleCtx.fill();

appleImage.src = appleCanvas.toDataURL();

// Game configuration
const TICK_RATE = 200; // ms per tick
var currentTickRate = TICK_RATE; // Current tick rate (gets faster as snake grows)
const SPEED_INCREASE_PER_FOOD = 3; // Decrease tick rate by this amount per food (faster)
const MIN_TICK_RATE = 50; // Minimum tick rate (maximum speed)

// Pause state
var isPaused = false;

// Input state
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};




// Core drawing utility
function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

// Clear the entire canvas
function clearCanvas() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw a circle at grid position (with camera offset)
function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc((x - cameraOffsetX) * GRID_SIZE + GRID_SIZE / 2, (y - cameraOffsetY) * GRID_SIZE + GRID_SIZE / 2, radius, 0, Math.PI * 2);
    ctx.fill();
}

// Draw snake head with face image (with camera offset)
function drawSnakeHead(x, y, radius, color, direction) {
    // Draw the circle for the head
    drawCircle(x, y, radius, color);

    // Draw the face image on top
    const centerX = (x - cameraOffsetX) * GRID_SIZE + GRID_SIZE / 2;
    const centerY = (y - cameraOffsetY) * GRID_SIZE + GRID_SIZE / 2;
    const faceSize = GRID_SIZE * 0.8;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Rotate based on direction
    let rotation = 0;
    if (direction === 'right') rotation = 0;
    else if (direction === 'down') rotation = Math.PI / 2;
    else if (direction === 'left') rotation = Math.PI;
    else if (direction === 'up') rotation = -Math.PI / 2;
    ctx.rotate(rotation);

    ctx.drawImage(snakeFaceImage, -faceSize / 2, -faceSize / 2, faceSize, faceSize);
    ctx.restore();
}

// Draw apple at grid position (with camera offset)
function drawApple(x, y) {
    const centerX = (x - cameraOffsetX) * GRID_SIZE;
    const centerY = (y - cameraOffsetY) * GRID_SIZE;
    ctx.drawImage(appleImage, centerX, centerY, GRID_SIZE, GRID_SIZE);
}

// Draw triangular tail with rounded tip (with camera offset)
function drawTail(tailX, tailY, nextX, nextY, color) {
    const centerX = (tailX - cameraOffsetX) * GRID_SIZE + GRID_SIZE / 2;
    const centerY = (tailY - cameraOffsetY) * GRID_SIZE + GRID_SIZE / 2;

    // Calculate direction from tail to next segment
    const dx = nextX - tailX;
    const dy = nextY - tailY;
    const angle = Math.atan2(dy, dx);

    // Draw slightly smaller rounded circle for tail tip
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, GRID_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();

    // Draw small triangle base pointing toward next segment
    const baseWidth = GRID_SIZE / 2.5;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
        centerX + Math.cos(angle + Math.PI / 2) * baseWidth / 2,
        centerY + Math.sin(angle + Math.PI / 2) * baseWidth / 2
    );
    ctx.lineTo(
        centerX + Math.cos(angle - Math.PI / 2) * baseWidth / 2,
        centerY + Math.sin(angle - Math.PI / 2) * baseWidth / 2
    );
    ctx.closePath();
    ctx.fill();
}

// Keyboard input handler
function keyPressed(e) {
    if (e.key.startsWith('Arrow')) {
        let newDirection = null;
        switch(e.key) {
            case 'ArrowUp':
                keys.up = true;
                newDirection = 'up';
                break;
            case 'ArrowDown':
                keys.down = true;
                newDirection = 'down';
                break;
            case 'ArrowLeft':
                keys.left = true;
                newDirection = 'left';
                break;
            case 'ArrowRight':
                keys.right = true;
                newDirection = 'right';
                break;
        }

        // Add to buffer (max 2 inputs buffered)
        if (newDirection && inputBuffer.length < 2) {
            inputBuffer.push(newDirection);
        }

        e.preventDefault();
    }
}

// Register keyboard listener
document.addEventListener('keydown', keyPressed);

// Touch/swipe handling
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

const MIN_SWIPE_DISTANCE = 30; // Minimum distance for a swipe to register

function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    e.preventDefault();
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
    e.preventDefault();
}

function handleSwipe() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Check if swipe meets minimum distance
    if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE && Math.abs(deltaY) < MIN_SWIPE_DISTANCE) {
        return; // Not a swipe, ignore
    }

    let newDirection = null;

    // Determine swipe direction (horizontal vs vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0) {
            newDirection = 'right';
        } else {
            newDirection = 'left';
        }
    } else {
        // Vertical swipe
        if (deltaY > 0) {
            newDirection = 'down';
        } else {
            newDirection = 'up';
        }
    }

    // Add to buffer (max 2 inputs buffered), same logic as keyboard
    if (newDirection && inputBuffer.length < 2) {
        inputBuffer.push(newDirection);
    }
}

// Register touch listeners with passive: false to allow preventDefault
document.addEventListener('touchstart', handleTouchStart, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: false });
document.addEventListener('touchmove', function(e) {
    e.preventDefault();
}, { passive: false });

// Pause/Play button handlers
document.addEventListener('DOMContentLoaded', function() {
    const pauseBtn = document.getElementById('pauseBtn');
    const playBtn = document.getElementById('playBtn');

    pauseBtn.addEventListener('click', function() {
        isPaused = true;
        pauseBtn.style.display = 'none';
        playBtn.style.display = 'block';
        playBtn.classList.add('paused');
    });

    playBtn.addEventListener('click', function() {
        isPaused = false;
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'block';
        playBtn.classList.remove('paused');
        // Reset last tick time to prevent sudden jumps
        lastTickTime = performance.now();
    });
});


var snakeHead_X = 0;
var snakeHead_Y = 0;
var snakeDirection = 'right';
var snakeBody = []; // Array to store body segments

// Input buffer for queuing direction changes
var inputBuffer = [];

var food_X = 10;
var food_Y = 10;

var GRID_SIZE = 20;

// Score tracking
var score = 0;

// Viewport/Camera offset
var cameraOffsetX = 0;
var cameraOffsetY = 0;

// Secret room state
var inSecretRoom = false;

// Secret room player position (separate from main room)
var secretSnakeHead_X = 0;
var secretSnakeHead_Y = GRID_SIZE - 1;
var secretSnakeDirection = 'right';
var secretSnakeBody = [];

// Secret room food
var secretFood_X = 10;
var secretFood_Y = 10;

// Second food in secret room
var secretFood2_X = 15;
var secretFood2_Y = 5;

// Yellow enemy snake in secret room
var enemyHead_X = 10;
var enemyHead_Y = 10;
var enemyBody = [
    {x: 9, y: 10},
    {x: 8, y: 10},
    {x: 7, y: 10},
    {x: 6, y: 10}
]; // Starts with 5 segments total (head + 4 body)

// Interpolation variables
var lastTickTime = 0;
var interpolationFactor = 0;
var enemyTickCounter = 0; // Counter to make enemy move slower

// Store previous positions for interpolation
var prevSnakeHead_X = 0;
var prevSnakeHead_Y = 0;
var prevSnakeBody = [];
var prevSecretSnakeHead_X = 0;
var prevSecretSnakeHead_Y = GRID_SIZE - 1;
var prevSecretSnakeBody = [];
var prevEnemyHead_X = 10;
var prevEnemyHead_Y = 10;
var prevEnemyBody = [];

// Game logic update (called every TICK_RATE ms)
function updateGameState() {
    if (!inSecretRoom) {
        // MAIN ROOM UPDATE
        // Process input buffer
        if (inputBuffer.length > 0) {
            snakeDirection = inputBuffer.shift();
        }

        // Store previous positions
        prevSnakeHead_X = snakeHead_X;
        prevSnakeHead_Y = snakeHead_Y;
        prevSnakeBody = snakeBody.map(seg => ({x: seg.x, y: seg.y}));

        // Move body segments
        for (let i = snakeBody.length - 1; i > 0; i--) {
            snakeBody[i].x = snakeBody[i - 1].x;
            snakeBody[i].y = snakeBody[i - 1].y;
        }

        if (snakeBody.length > 0) {
            snakeBody[0].x = snakeHead_X;
            snakeBody[0].y = snakeHead_Y;
        }

        // Move head
        if (snakeDirection == 'right') snakeHead_X += 1;
        if (snakeDirection == 'left') snakeHead_X -= 1;
        if (snakeDirection == 'up') snakeHead_Y -= 1;
        if (snakeDirection == 'down') snakeHead_Y += 1;

        // Check for entering secret room
        if (snakeHead_X >= GRID_SIZE && snakeHead_Y == GRID_SIZE - 1 && snakeDirection == 'right') {
            inSecretRoom = true;
            // Reset secret room head position to entrance
            secretSnakeHead_X = 0;
            secretSnakeHead_Y = GRID_SIZE - 1;
            secretSnakeDirection = 'right';
            // Copy body segments to secret room snake
            secretSnakeBody = [];
            for (let i = 0; i < snakeBody.length; i++) {
                secretSnakeBody.push({x: secretSnakeHead_X - i - 1, y: secretSnakeHead_Y});
            }
            // Initialize previous positions for smooth interpolation
            prevSecretSnakeHead_X = secretSnakeHead_X;
            prevSecretSnakeHead_Y = secretSnakeHead_Y;
            prevSecretSnakeBody = secretSnakeBody.map(seg => ({x: seg.x, y: seg.y}));
            // Reset enemy to opposite corner from player entrance
            enemyHead_X = GRID_SIZE - 1;
            enemyHead_Y = 0;
            enemyBody = [
                {x: GRID_SIZE - 2, y: 0},
                {x: GRID_SIZE - 3, y: 0},
                {x: GRID_SIZE - 4, y: 0},
                {x: GRID_SIZE - 5, y: 0}
            ];
            prevEnemyHead_X = enemyHead_X;
            prevEnemyHead_Y = enemyHead_Y;
            prevEnemyBody = enemyBody.map(seg => ({x: seg.x, y: seg.y}));
            enemyTickCounter = 0;
            return;
        }

        // Main room boundaries
        if (snakeHead_X < 0) snakeHead_X = 0;
        if (snakeHead_Y < 0) snakeHead_Y = 0;
        if (snakeHead_Y != GRID_SIZE - 1 && snakeHead_X > GRID_SIZE - 1) snakeHead_X = GRID_SIZE - 1;
        if (snakeHead_Y > GRID_SIZE - 1) snakeHead_Y = GRID_SIZE - 1;

        // Food collision
        if (snakeHead_X == food_X && snakeHead_Y == food_Y) {
            snakeBody.push({x: snakeHead_X, y: snakeHead_Y});
            food_X = Math.floor(Math.random() * GRID_SIZE);
            food_Y = Math.floor(Math.random() * GRID_SIZE);
            score += 1;
            // Increase speed (decrease tick rate)
            currentTickRate = Math.max(MIN_TICK_RATE, currentTickRate - SPEED_INCREASE_PER_FOOD);
        }
    } else {
        // SECRET ROOM UPDATE
        // Process input buffer
        if (inputBuffer.length > 0) {
            secretSnakeDirection = inputBuffer.shift();
        }

        // Store previous positions
        prevSecretSnakeHead_X = secretSnakeHead_X;
        prevSecretSnakeHead_Y = secretSnakeHead_Y;
        prevSecretSnakeBody = secretSnakeBody.map(seg => ({x: seg.x, y: seg.y}));

        // Move body segments
        for (let i = secretSnakeBody.length - 1; i > 0; i--) {
            secretSnakeBody[i].x = secretSnakeBody[i - 1].x;
            secretSnakeBody[i].y = secretSnakeBody[i - 1].y;
        }

        if (secretSnakeBody.length > 0) {
            secretSnakeBody[0].x = secretSnakeHead_X;
            secretSnakeBody[0].y = secretSnakeHead_Y;
        }

        // Move head
        if (secretSnakeDirection == 'right') secretSnakeHead_X += 1;
        if (secretSnakeDirection == 'left') secretSnakeHead_X -= 1;
        if (secretSnakeDirection == 'up') secretSnakeHead_Y -= 1;
        if (secretSnakeDirection == 'down') secretSnakeHead_Y += 1;

        // Check for leaving secret room
        if (secretSnakeHead_X < 0 && secretSnakeHead_Y == GRID_SIZE - 1 && secretSnakeDirection == 'left') {
            inSecretRoom = false;
            // Set main room head position to exit location
            snakeHead_X = GRID_SIZE - 1;
            snakeHead_Y = GRID_SIZE - 1;
            snakeDirection = 'left';
            // Copy body segments from secret room to main room
            snakeBody = [];
            for (let i = 0; i < secretSnakeBody.length; i++) {
                snakeBody.push({x: snakeHead_X + i + 1, y: snakeHead_Y});
            }
            // Store previous positions for smooth interpolation
            prevSnakeHead_X = snakeHead_X;
            prevSnakeHead_Y = snakeHead_Y;
            prevSnakeBody = snakeBody.map(seg => ({x: seg.x, y: seg.y}));
            return;
        }

        // Secret room boundaries
        if (secretSnakeHead_X < 0) secretSnakeHead_X = 0;
        if (secretSnakeHead_Y < 0) secretSnakeHead_Y = 0;
        if (secretSnakeHead_X > GRID_SIZE - 1) secretSnakeHead_X = GRID_SIZE - 1;
        if (secretSnakeHead_Y > GRID_SIZE - 1) secretSnakeHead_Y = GRID_SIZE - 1;

        // Food collision - first food
        if (secretSnakeHead_X == secretFood_X && secretSnakeHead_Y == secretFood_Y) {
            secretSnakeBody.push({x: secretSnakeHead_X, y: secretSnakeHead_Y});
            secretFood_X = Math.floor(Math.random() * GRID_SIZE);
            secretFood_Y = Math.floor(Math.random() * GRID_SIZE);
            score += 1;
            // Increase speed (decrease tick rate)
            currentTickRate = Math.max(MIN_TICK_RATE, currentTickRate - SPEED_INCREASE_PER_FOOD);
        }

        // Food collision - second food
        if (secretSnakeHead_X == secretFood2_X && secretSnakeHead_Y == secretFood2_Y) {
            secretSnakeBody.push({x: secretSnakeHead_X, y: secretSnakeHead_Y});
            secretFood2_X = Math.floor(Math.random() * GRID_SIZE);
            secretFood2_Y = Math.floor(Math.random() * GRID_SIZE);
            score += 1;
            // Increase speed (decrease tick rate)
            currentTickRate = Math.max(MIN_TICK_RATE, currentTickRate - SPEED_INCREASE_PER_FOOD);
        }

        // Update enemy snake (moves slower - every 2 ticks)
        // Always store previous positions for smooth interpolation
        prevEnemyHead_X = enemyHead_X;
        prevEnemyHead_Y = enemyHead_Y;
        prevEnemyBody = enemyBody.map(seg => ({x: seg.x, y: seg.y}));

        enemyTickCounter++;
        if (enemyTickCounter >= 2) {
            enemyTickCounter = 0;

            // Move enemy body
            for (let i = enemyBody.length - 1; i > 0; i--) {
                enemyBody[i].x = enemyBody[i - 1].x;
                enemyBody[i].y = enemyBody[i - 1].y;
            }

            if (enemyBody.length > 0) {
                enemyBody[0].x = enemyHead_X;
                enemyBody[0].y = enemyHead_Y;
            }

            // Simple AI: Chase the player
            const dx = secretSnakeHead_X - enemyHead_X;
            const dy = secretSnakeHead_Y - enemyHead_Y;

            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) enemyHead_X += 1;
                else enemyHead_X -= 1;
            } else {
                if (dy > 0) enemyHead_Y += 1;
                else enemyHead_Y -= 1;
            }

            // Keep enemy in bounds
            if (enemyHead_X < 0) enemyHead_X = 0;
            if (enemyHead_Y < 0) enemyHead_Y = 0;
            if (enemyHead_X > GRID_SIZE - 1) enemyHead_X = GRID_SIZE - 1;
            if (enemyHead_Y > GRID_SIZE - 1) enemyHead_Y = GRID_SIZE - 1;
        }

        // Check if player head touches enemy body -> player loses
        let playerTouchedEnemyBody = false;
        for (let i = 0; i < enemyBody.length; i++) {
            if (secretSnakeHead_X == enemyBody[i].x && secretSnakeHead_Y == enemyBody[i].y) {
                playerTouchedEnemyBody = true;
                break;
            }
        }

        if (playerTouchedEnemyBody) {
            // Reset to main room at beginning
            inSecretRoom = false;
            snakeHead_X = 0;
            snakeHead_Y = 0;
            snakeDirection = 'right';
            snakeBody = [];
            prevSnakeHead_X = snakeHead_X;
            prevSnakeHead_Y = snakeHead_Y;
            prevSnakeBody = [];
            // Reset speed to initial value
            currentTickRate = TICK_RATE;
        }

        // Check if enemy head touches player body -> enemy disappears
        let enemyTouchedPlayerBody = false;
        for (let i = 0; i < secretSnakeBody.length; i++) {
            if (enemyHead_X == secretSnakeBody[i].x && enemyHead_Y == secretSnakeBody[i].y) {
                enemyTouchedPlayerBody = true;
                break;
            }
        }

        if (enemyTouchedPlayerBody) {
            // Respawn enemy at a random location away from player
            enemyHead_X = Math.floor(Math.random() * GRID_SIZE);
            enemyHead_Y = Math.floor(Math.random() * GRID_SIZE);
            // Make sure enemy doesn't spawn too close to player
            while (Math.abs(enemyHead_X - secretSnakeHead_X) < 5 && Math.abs(enemyHead_Y - secretSnakeHead_Y) < 5) {
                enemyHead_X = Math.floor(Math.random() * GRID_SIZE);
                enemyHead_Y = Math.floor(Math.random() * GRID_SIZE);
            }
            enemyBody = [
                {x: enemyHead_X - 1, y: enemyHead_Y},
                {x: enemyHead_X - 2, y: enemyHead_Y},
                {x: enemyHead_X - 3, y: enemyHead_Y},
                {x: enemyHead_X - 4, y: enemyHead_Y}
            ];
            prevEnemyHead_X = enemyHead_X;
            prevEnemyHead_Y = enemyHead_Y;
            prevEnemyBody = enemyBody.map(seg => ({x: seg.x, y: seg.y}));
        }
    }
}

// Update debug display
function updateDebugDisplay() {
    const roomInfo = document.getElementById('room-info');
    const headPos = document.getElementById('head-pos');
    const direction = document.getElementById('direction');
    const tailCount = document.getElementById('tail-count');
    const tailArray = document.getElementById('tail-array');

    if (!inSecretRoom) {
        roomInfo.textContent = 'Main Room';
        headPos.textContent = `X: ${snakeHead_X}, Y: ${snakeHead_Y}`;
        direction.textContent = snakeDirection;
        tailCount.textContent = snakeBody.length;

        // Display tail array
        if (snakeBody.length === 0) {
            tailArray.innerHTML = '<div class="tail-segment">[]</div>';
        } else {
            let html = '';
            snakeBody.forEach((seg, i) => {
                html += `<div class="tail-segment">[${i}] X: ${seg.x}, Y: ${seg.y}</div>`;
            });
            tailArray.innerHTML = html;
        }
    } else {
        roomInfo.textContent = 'Secret Room';
        headPos.textContent = `X: ${secretSnakeHead_X}, Y: ${secretSnakeHead_Y}`;
        direction.textContent = secretSnakeDirection;
        tailCount.textContent = secretSnakeBody.length;

        // Display tail array
        if (secretSnakeBody.length === 0) {
            tailArray.innerHTML = '<div class="tail-segment">[]</div>';
        } else {
            let html = '';
            secretSnakeBody.forEach((seg, i) => {
                html += `<div class="tail-segment">[${i}] X: ${seg.x}, Y: ${seg.y}</div>`;
            });
            tailArray.innerHTML = html;
        }
    }
}

// Render function (called every frame with interpolation)
function render(interpolation) {
    clearCanvas();

    // Update camera position based on which room we're in
    if (!inSecretRoom) {
        cameraOffsetX = 0;
        cameraOffsetY = 0;
    } else {
        cameraOffsetX = 0;
        cameraOffsetY = 0;
    }

    if (!inSecretRoom) {
        // RENDER MAIN ROOM
        // Interpolate snake head position
        const interpHeadX = prevSnakeHead_X + (snakeHead_X - prevSnakeHead_X) * interpolation;
        const interpHeadY = prevSnakeHead_Y + (snakeHead_Y - prevSnakeHead_Y) * interpolation;

        // Draw snake body segments with interpolation
        for (let i = snakeBody.length - 1; i >= 0; i--) {
            const prevPos = prevSnakeBody[i] || snakeBody[i];
            const interpX = prevPos.x + (snakeBody[i].x - prevPos.x) * interpolation;
            const interpY = prevPos.y + (snakeBody[i].y - prevPos.y) * interpolation;

            // Draw tail with triangular shape
            if (i === snakeBody.length - 1 && snakeBody.length > 0) {
                const nextSegment = snakeBody.length > 1 ? snakeBody[i - 1] : {x: snakeHead_X, y: snakeHead_Y};
                const nextPrevPos = prevSnakeBody[i - 1] || nextSegment;
                const interpNextX = nextPrevPos.x + (nextSegment.x - nextPrevPos.x) * interpolation;
                const interpNextY = nextPrevPos.y + (nextSegment.y - nextPrevPos.y) * interpolation;
                drawTail(interpX, interpY, interpNextX, interpNextY, 'red');
            } else {
                drawCircle(interpX, interpY, GRID_SIZE / 2, 'red');
            }
        }

        // Draw snake head with face (interpolated)
        drawSnakeHead(interpHeadX, interpHeadY, GRID_SIZE / 2, 'red', snakeDirection);
    } else {
        // RENDER SECRET ROOM
        // Interpolate secret room snake head position
        const interpSecretHeadX = prevSecretSnakeHead_X + (secretSnakeHead_X - prevSecretSnakeHead_X) * interpolation;
        const interpSecretHeadY = prevSecretSnakeHead_Y + (secretSnakeHead_Y - prevSecretSnakeHead_Y) * interpolation;

        // Draw secret room snake body segments
        for (let i = secretSnakeBody.length - 1; i >= 0; i--) {
            const prevPos = prevSecretSnakeBody[i] || secretSnakeBody[i];
            const interpX = prevPos.x + (secretSnakeBody[i].x - prevPos.x) * interpolation;
            const interpY = prevPos.y + (secretSnakeBody[i].y - prevPos.y) * interpolation;

            if (i === secretSnakeBody.length - 1 && secretSnakeBody.length > 0) {
                const nextSegment = secretSnakeBody.length > 1 ? secretSnakeBody[i - 1] : {x: secretSnakeHead_X, y: secretSnakeHead_Y};
                const nextPrevPos = prevSecretSnakeBody[i - 1] || nextSegment;
                const interpNextX = nextPrevPos.x + (nextSegment.x - nextPrevPos.x) * interpolation;
                const interpNextY = nextPrevPos.y + (nextSegment.y - nextPrevPos.y) * interpolation;
                drawTail(interpX, interpY, interpNextX, interpNextY, 'red');
            } else {
                drawCircle(interpX, interpY, GRID_SIZE / 2, 'red');
            }
        }

        // Draw secret room snake head
        drawSnakeHead(interpSecretHeadX, interpSecretHeadY, GRID_SIZE / 2, 'red', secretSnakeDirection);

        // Draw enemy snake
        // Interpolate enemy head position
        const interpEnemyHeadX = prevEnemyHead_X + (enemyHead_X - prevEnemyHead_X) * interpolation;
        const interpEnemyHeadY = prevEnemyHead_Y + (enemyHead_Y - prevEnemyHead_Y) * interpolation;

        // Draw enemy body segments
        for (let i = enemyBody.length - 1; i >= 0; i--) {
            const prevPos = prevEnemyBody[i] || enemyBody[i];
            const interpX = prevPos.x + (enemyBody[i].x - prevPos.x) * interpolation;
            const interpY = prevPos.y + (enemyBody[i].y - prevPos.y) * interpolation;

            if (i === enemyBody.length - 1 && enemyBody.length > 0) {
                const nextSegment = enemyBody.length > 1 ? enemyBody[i - 1] : {x: enemyHead_X, y: enemyHead_Y};
                const nextPrevPos = prevEnemyBody[i - 1] || nextSegment;
                const interpNextX = nextPrevPos.x + (nextSegment.x - nextPrevPos.x) * interpolation;
                const interpNextY = nextPrevPos.y + (nextSegment.y - nextPrevPos.y) * interpolation;
                drawTail(interpX, interpY, interpNextX, interpNextY, 'yellow');
            } else {
                drawCircle(interpX, interpY, GRID_SIZE / 2, 'yellow');
            }
        }

        // Draw enemy head
        drawCircle(interpEnemyHeadX, interpEnemyHeadY, GRID_SIZE / 2, 'yellow');
    }

    // Draw food (with camera offset)
    if (!inSecretRoom) {
        drawApple(food_X, food_Y);

        // Draw hole indicator at bottom right
        ctx.fillStyle = '#333';
        drawRect((GRID_SIZE - 1 - cameraOffsetX) * GRID_SIZE, (GRID_SIZE - 1 - cameraOffsetY) * GRID_SIZE, GRID_SIZE * 2, GRID_SIZE, '#333');
    } else {
        // Draw both food apples in secret room
        drawApple(secretFood_X, secretFood_Y);
        drawApple(secretFood2_X, secretFood2_Y);
    }

    // Draw scoreboard in bottom left corner
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText('Score: ' + score, 10, canvas.height - 10);

    // Update debug display
    updateDebugDisplay();
}

function drawCell(x, y, color) {
    drawRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE, color);

}

// Game loop with interpolation
function gameLoop(currentTime) {
    // Calculate time since last tick
    const timeSinceLastTick = currentTime - lastTickTime;

    // Determine tick rate based on room (secret room is faster/harder)
    const effectiveTickRate = inSecretRoom ? currentTickRate * 0.7 : currentTickRate;

    // Only update game state if not paused
    if (!isPaused) {
        // Update game state if enough time has passed
        if (timeSinceLastTick >= effectiveTickRate) {
            updateGameState();
            lastTickTime = currentTime;
        }

        // Calculate interpolation factor (0 to 1)
        interpolationFactor = Math.min(1, (currentTime - lastTickTime) / effectiveTickRate);
    }

    // Always render (even when paused)
    render(interpolationFactor);

    // Continue the loop
    requestAnimationFrame(gameLoop);
}

// Start the game
lastTickTime = performance.now();
requestAnimationFrame(gameLoop);
