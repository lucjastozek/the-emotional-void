let sun, socket;
let stars = [];
let orbits = [];
const palette = [
  "#573280",
  "#70587C",
  "#23B5D3",
  "#3587A4",
  "#14591D",
  "#2D854A",
  "#EA9010",
  "#FA8334",
  "#D64933",
  "#DA4167",
];

let planetPalette = [...palette];
let opacity = "ff";

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return [...a].sort().every((val, i) => val === [...b].sort()[i]);
}

function toHex(n) {
  return int(n).toString(16).padStart(2, "0");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  sun = new Sun();
  socket = new WebSocket("ws://localhost:8080");

  socket.onopen = () => {
    console.log("WebSocket connection opened");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event === "heartbeat") {
        sun.beat();
      } else if (data.event === "measurement") {
        // temperature
        const newTemperature = data.measurements.temperature;
        const i = map(newTemperature, 30, 40, 0, 9);
        let newPalette = [];

        if (i + 2 > 9) {
          newPalette = palette.slice(6, 10);
        } else if (i - 2 < 0) {
          newPalette = palette.slice(0, 4);
        } else {
          newPalette = palette.slice(i - 2, i + 2);
        }

        if (!arraysEqual(newPalette, planetPalette)) {
          planetPalette = newPalette;
          for (const orbit of orbits) {
            orbit.updateColor();
          }
        }

        // humidity
        const newHumidity = data.measurements.humidity;
        const n = map(newHumidity, 50, 100, 128, 50, true);
        opacity = toHex(n);

        // gsr
        const newGSR = data.measurements.gsr;
        const v = map(newGSR, 0, 300, 0.005, 0.001, true);

        for (const orbit of orbits) {
          console.log(v);
          orbit.updateRotationSpeed(v);
        }
      }
    } catch (err) {
      console.warn("Received invalid JSON: ", event.data);
    }
  };

  for (let i = 0; i < 10; i++) {
    stars.push(new Star());
  }

  for (let i = 1.4; sun.d * i <= max(width, height) * 1.5; i += 0.5) {
    orbits.push(new Orbit(sun.d * i, i * 27, 0.27));
  }

  frameRate(60);
  background("#050505");
}

function draw() {
  background("#050505" + opacity);

  for (const star of stars) {
    star.show();
  }

  sun.update();
  sun.show();

  for (const orbit of orbits) {
    orbit.update();
    orbit.show();
  }
}

class Sun {
  constructor() {
    this.x = width / 2;
    this.y = height / 2;
    this.d = min(width, height) * 0.2;
    this.color = "#fffbe6";

    this.pulseStart = 0;
    this.pulseDuration = 600; // 100 BPM
    this.size = this.d;
  }

  beat() {
    this.pulseStart = millis();
  }

  update() {
    const now = millis();
    const progress = (now - this.pulseStart) / this.pulseDuration;

    const pulse = cos(progress * PI * 2);
    const mapped = map(pulse, -1, 1, this.d * 0.9, this.d);
    this.size = mapped;
  }

  show() {
    const gradient = drawingContext.createRadialGradient(
      this.x,
      this.y,
      1,
      this.x,
      this.y,
      this.size
    );
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, "#05050588");

    drawingContext.fillStyle = gradient;

    drawingContext.beginPath();
    drawingContext.arc(this.x, this.y, this.size / 2, 0, TWO_PI);
    drawingContext.fill();
  }
}

class Star {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.d = min(width, height) * 0.001 * random(1, 10);
    this.color = "#EA9010";
    this.size = this.d;
  }

  show() {
    const outerRadius = this.d;
    const innerRadius = this.d / 2;

    push();
    translate(this.x, this.y);
    rotate(frameCount * 0.01);

    fill(this.color);
    noStroke();
    drawingContext.shadowColor = this.color + "40";
    drawingContext.shadowBlur = 20;

    beginShape();

    for (let i = 0; i < 8; i++) {
      const angle = (TWO_PI * i) / 8;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const vx = cos(angle) * r;
      const vy = sin(angle) * r;
      vertex(vx, vy);
    }

    endShape(CLOSE);
    drawingContext.shadowBlur = 0;

    pop();
  }
}

class Orbit {
  constructor(diameter, dashCount, dashLengthRatio) {
    this.x = width / 2;
    this.y = height / 2;
    this.d = diameter;
    this.dashCount = dashCount;
    this.dashLengthRatio = dashLengthRatio;
    this.planetDash = floor(random(this.dashCount));
    this.color = random(planetPalette);
    this.planetD = this.d * 0.027;
    this.planetSize = this.planetD;
    this.speed = frameCount * 0.27;
    this.rotation = 0;
    this.rotationSpeed = 0.001;
  }

  updateColor() {
    this.color = random(planetPalette);
  }

  updateRotationSpeed(v) {
    this.rotationSpeed = v;
  }

  update() {
    const now = millis();
    const progress = (now - sun.pulseStart) / sun.pulseDuration;

    const pulse = cos(progress * PI * 2);
    const mapped = map(pulse, -1, 1, this.planetD * 0.9, this.planetD);
    this.planetSize = mapped;
    this.rotation += this.rotationSpeed;
  }

  show() {
    noFill();
    stroke("#fffbe611");
    strokeWeight(1);
    push();
    translate(this.x, this.y);
    rotate(this.rotation);

    const angleStep = TWO_PI / this.dashCount;
    const dashAngle = angleStep * this.dashLengthRatio;

    for (let i = 0; i < this.dashCount; i++) {
      const startAngle = i * angleStep;
      const endAngle = startAngle + dashAngle;
      arc(0, 0, this.d, this.d, startAngle, endAngle);

      if (i === this.planetDash) {
        const midAngle = (startAngle + endAngle) / 2;
        const radius = this.d / 2;
        const px = cos(midAngle) * radius;
        const py = sin(midAngle) * radius;

        const gradient = drawingContext.createRadialGradient(
          px,
          py,
          1,
          px,
          py,
          this.planetSize
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, "#05050588");

        drawingContext.fillStyle = gradient;

        drawingContext.beginPath();
        drawingContext.arc(px, py, this.planetSize / 2, 0, TWO_PI);
        drawingContext.fill();

        noFill();
        stroke("#fffbe655");
      }
    }
    pop();
  }
}
