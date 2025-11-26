      

      // START: Konfigurasi efek partikel, bintang, dan elang
    const config = {
      particleCount: 100,      // Jumlah partikel biasa
      starCount: 50,          // Jumlah bintang berkedip
      eagleCount: 2,          // Jumlah elang galaksi
      baseHue: 200,           // Warna dasar biru untuk partikel
      starHue: 60,            // Warna dasar kuning untuk bintang
      eagleHue: 270,          // Warna dasar ungu untuk elang
      hueRange: 30,           // Rentang variasi warna
      sizeRange: [0.5, 3],    // Ukuran partikel minimum dan maksimum
      starSizeRange: [0.3, 1.5], // Ukuran bintang
      eagleSize: 20,          // Ukuran dasar elang
      speedRange: 0.5,        // Kecepatan gerakan partikel
      eagleSpeed: 2,          // Kecepatan gerakan elang
      lineDistance: 100,      // Jarak maksimum untuk menggambar garis
      lineOpacity: 0.15,      // Opasitas garis
      particleOpacity: 0.7,   // Opasitas partikel
      starOpacity: 0.9,       // Opasitas bintang
      eagleOpacity: 0.8       // Opasitas elang
    };
    // END: Konfigurasi efek partikel, bintang, dan elang

    // START: Inisialisasi canvas untuk efek galaksi
    const canvas = document.getElementById("particleCanvas");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // END: Inisialisasi canvas untuk efek galaksi

    // START: Kelas Partikel dengan fitur galaksi
    class Particle {
      constructor() {
        this.reset(true);
        this.velocity = {
          x: (Math.random() - 0.5) * config.speedRange,
          y: (Math.random() - 0.5) * config.speedRange
        };
        this.history = [];
        this.maxHistory = 5;
      }

      reset(initial = false) {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * (config.sizeRange[1] - config.sizeRange[0]) + config.sizeRange[0];
        this.hue = config.baseHue + (Math.random() * config.hueRange - config.hueRange / 2);
        this.alpha = Math.random() * 0.5 + config.particleOpacity;
      }

      update() {
        this.history.unshift({ x: this.x, y: this.y });
        if (this.history.length > this.maxHistory) this.history.pop();

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        if (this.x > canvas.width + this.size || this.x < -this.size ||
            this.y > canvas.height + this.size || this.y < -this.size) {
          this.reset();
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 70%, ${this.alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 70%, ${this.alpha * 0.3})`;
        ctx.fill();

        for (let i = 0; i < this.history.length; i++) {
          const point = this.history[i];
          const ratio = (i + 1) / this.history.length;
          ctx.beginPath();
          ctx.arc(point.x, point.y, this.size * ratio, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${this.hue}, 80%, 70%, ${this.alpha * ratio * 0.5})`;
          ctx.fill();
        }
      }
    }
    // END: Kelas Partikel dengan fitur galaksi

    // START: Kelas Bintang dengan efek berkedip
    class Star {
      constructor() {
        this.reset(true);
        this.twinkleSpeed = Math.random() * 0.05 + 0.02;
        this.twinklePhase = Math.random() * Math.PI * 2;
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * (config.starSizeRange[1] - config.starSizeRange[0]) + config.starSizeRange[0];
        this.hue = config.starHue + (Math.random() * 10 - 5);
        this.baseAlpha = Math.random() * 0.3 + config.starOpacity;
      }

      update(time) {
        this.alpha = this.baseAlpha * (0.5 + 0.5 * Math.sin(time * this.twinkleSpeed + this.twinklePhase));
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 90%, 90%, ${this.alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 90%, 90%, ${this.alpha * 0.2})`;
        ctx.fill();
      }
    }
    // END: Kelas Bintang dengan efek berkedip

    // START: Kelas Elang dengan animasi terbang
    class Eagle {
      constructor() {
        this.reset(true);
        this.velocity = {
          x: config.eagleSpeed * (Math.random() * 0.5 + 0.5),
          y: (Math.random() - 0.5) * config.eagleSpeed
        };
        this.phase = Math.random() * Math.PI * 2;
        this.wingSpeed = Math.random() * 0.1 + 0.05;
      }

      reset(initial = false) {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = config.eagleSize;
        this.hue = config.eagleHue + (Math.random() * 20 - 10);
        this.alpha = config.eagleOpacity;
      }

      update(time) {
        this.x += this.velocity.x;
        this.y += this.velocity.y + Math.sin(time * 0.001 + this.phase) * 2; // Lintasan melengkung
        this.wingAngle = Math.sin(time * this.wingSpeed) * Math.PI / 4; // Gerakan sayap

        if (this.x > canvas.width + this.size || this.x < -this.size ||
            this.y > canvas.height + this.size || this.y < -this.size) {
          this.reset();
        }
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.velocity.y, this.velocity.x)); // Rotasi sesuai arah

        // Gambar tubuh elang
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 0.5, this.size * 0.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, ${this.alpha})`;
        ctx.fill();

        // Gambar sayap kiri
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.size * 0.8, -this.size * Math.sin(this.wingAngle));
        ctx.lineTo(-this.size * 1.2, this.size * 0.5 * Math.sin(this.wingAngle));
        ctx.closePath();
        ctx.fillStyle = `hsla(${this.hue}, 80%, 50%, ${this.alpha * 0.8})`;
        ctx.fill();

        // Gambar sayap kanan
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.size * 0.8, -this.size * Math.sin(this.wingAngle));
        ctx.lineTo(this.size * 1.2, this.size * 0.5 * Math.sin(this.wingAngle));
        ctx.closePath();
        ctx.fillStyle = `hsla(${this.hue}, 80%, 50%, ${this.alpha * 0.8})`;
        ctx.fill();

        // Efek cahaya galaksi
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 0.7, this.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 70%, ${this.alpha * 0.3})`;
        ctx.fill();

        ctx.restore();
      }
    }
    // END: Kelas Elang dengan animasi terbang

    // START: Buat array partikel, bintang, dan elang
    const particles = [];
    const stars = [];
    const eagles = [];
    for (let i = 0; i < config.particleCount; i++) {
      particles.push(new Particle());
    }
    for (let i = 0; i < config.starCount; i++) {
      stars.push(new Star());
    }
    for (let i = 0; i < config.eagleCount; i++) {
      eagles.push(new Eagle());
    }
    // END: Buat array partikel, bintang, dan elang

    // START: Loop animasi dengan efek galaksi
    let lastTime = 0;
    const fps = 60;
    const interval = 1000 / fps;

    function animate(currentTime) {
      requestAnimationFrame(animate);
      const deltaTime = currentTime - lastTime;
      if (deltaTime < interval) return;
      lastTime = currentTime - (deltaTime % interval);

      ctx.fillStyle = `rgba(15, 23, 42, 0.1)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawConnections();

      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      stars.forEach(star => {
        star.update(currentTime / 1000);
        star.draw();
      });

      eagles.forEach(eagle => {
        eagle.update(currentTime / 1000);
        eagle.draw();
      });
    }
    // END: Loop animasi dengan efek galaksi

    // START: Gambar koneksi antar partikel
    function drawConnections() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const distance = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

          if (distance < config.lineDistance) {
            const opacity = 1 - (distance / config.lineDistance);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(${config.baseHue}, 60%, 70%, ${opacity * config.lineOpacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }
    // END: Gambar koneksi antar partikel

    // START: Tangani perubahan ukuran jendela
    function handleResize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    // END: Tangani perubahan ukuran jendela

    // START: Interaksi mouse
    let mouseX = null;
    let mouseY = null;
    const mouseRadius = 100;

    function handleMouseMove(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }

    function handleMouseLeave() {
      mouseX = null;
      mouseY = null;
    }
    // END: Interaksi mouse

    // START: Inisialisasi event listener
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    animate(0);
    // END: Inisialisasi event listener