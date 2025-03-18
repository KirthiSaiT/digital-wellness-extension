window.Chart = function(canvasContext, config) {
    this.ctx = canvasContext;
    this.config = config;
    this.canvas = canvasContext.canvas;
    this.tooltip = { visible: false, x: 0, y: 0, text: '' };
    this.animationProgress = 0;
    this.setupEventListeners();
    this.animate();
  };
  
  Chart.prototype.destroy = function() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseout', this.handleMouseOut);
  };
  
  Chart.prototype.setupEventListeners = function() {
    this.handleMouseMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.updateTooltip(x, y);
      this.draw();
    };
  
    this.handleMouseOut = () => {
      this.tooltip.visible = false;
      this.draw();
    };
  
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseout', this.handleMouseOut);
  };
  
  Chart.prototype.updateTooltip = function(mouseX, mouseY) {
    this.tooltip.visible = false;
    const padding = 30;
    const width = this.canvas.width - 2 * padding;
    const height = this.canvas.height - 2 * padding;
  
    if (this.config.type === 'line') {
      const data = this.config.data.datasets[0].data;
      const labels = this.config.data.labels;
      const maxValue = Math.max(...data);
      const stepX = width / (labels.length - 1);
      for (let i = 0; i < data.length; i++) {
        const x = padding + i * stepX;
        const y = padding + height - (data[i] / maxValue * height) * this.animationProgress;
        if (Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2) < 10) {
          this.tooltip = { visible: true, x: x + 15, y: y - 15, text: `${labels[i]}: ${data[i]} min` };
          break;
        }
      }
    } else if (this.config.type === 'doughnut') {
      const data = this.config.data.datasets[0].data;
      const labels = this.config.data.labels;
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;
      const radius = Math.min(centerX, centerY) * 0.7;
      const total = data.reduce((sum, val) => sum + val, 0);
      let startAngle = 0;
      const mouseAngle = Math.atan2(mouseY - centerY, mouseX - centerX);
      const normalizedMouseAngle = mouseAngle < 0 ? mouseAngle + 2 * Math.PI : mouseAngle;
      for (let i = 0; i < data.length; i++) {
        const angle = (data[i] / total) * 2 * Math.PI;
        const endAngle = startAngle + angle;
        const distance = Math.sqrt((mouseX - centerX) ** 2 + (mouseY - centerY) ** 2);
        if (distance < radius && distance > radius * 0.5 && normalizedMouseAngle >= startAngle && normalizedMouseAngle <= endAngle) {
          this.tooltip = { visible: true, x: mouseX + 15, y: mouseY - 15, text: `${labels[i]}: ${data[i]} min` };
          break;
        }
        startAngle = endAngle;
      }
    } else if (this.config.type === 'bar') {
      const data = this.config.data.datasets[0].data;
      const labels = this.config.data.labels;
      const barWidth = (width / data.length) * 0.6;
      const maxValue = Math.max(...data);
      for (let i = 0; i < data.length; i++) {
        const x = padding + i * (barWidth + (width / data.length) * 0.4);
        const barHeight = (data[i] / maxValue * height) * this.animationProgress;
        const y = padding + height - barHeight;
        if (mouseX >= x && mouseX <= x + barWidth && mouseY >= y && mouseY <= padding + height) {
          this.tooltip = { visible: true, x: x + barWidth / 2, y: y - 15, text: `${labels[i]}: ${data[i]} min` };
          break;
        }
      }
    }
  };
  
  Chart.prototype.animate = function() {
    const duration = 1500;
    const start = performance.now();
    const animateFrame = (time) => {
      this.animationProgress = Math.min((time - start) / duration, 1);
      this.draw();
      if (this.animationProgress < 1) requestAnimationFrame(animateFrame);
    };
    requestAnimationFrame(animateFrame);
  };
  
  Chart.prototype.draw = function() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.config.type === 'line') this.drawLineChart();
    else if (this.config.type === 'doughnut') this.drawDoughnutChart();
    else if (this.config.type === 'bar') this.drawBarChart();
  
    if (this.tooltip.visible) {
      ctx.fillStyle = 'rgba(44, 62, 80, 0.9)';
      ctx.font = '12px Segoe UI';
      const textWidth = ctx.measureText(this.tooltip.text).width;
      ctx.fillRect(this.tooltip.x - 5, this.tooltip.y - 18, textWidth + 10, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(this.tooltip.text, this.tooltip.x, this.tooltip.y - 5);
    }
  };
  
  Chart.prototype.drawLineChart = function() {
    const ctx = this.ctx;
    const data = this.config.data.datasets[0].data;
    const labels = this.config.data.labels;
    const padding = 30;
    const width = this.canvas.width - 2 * padding;
    const height = this.canvas.height - 2 * padding;
    const maxValue = Math.max(...data);
    const stepX = width / (labels.length - 1);
  
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();
  
    ctx.fillStyle = '#495057';
    ctx.font = '12px Segoe UI';
    ctx.textAlign = 'right';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding + height - (i / ySteps) * height;
      const value = (i / ySteps) * maxValue;
      ctx.fillText(Math.round(value), padding - 5, y);
    }
  
    ctx.textAlign = 'center';
    for (let i = 0; i < labels.length; i++) {
      const x = padding + i * stepX;
      ctx.fillText(labels[i], x, padding + height + 15);
    }
  
    ctx.beginPath();
    ctx.strokeStyle = this.config.data.datasets[0].borderColor;
    ctx.lineWidth = 2;
    data.forEach((value, index) => {
      const x = padding + index * stepX;
      const y = padding + height - (value / maxValue * height) * this.animationProgress;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  
    ctx.fillStyle = this.config.data.datasets[0].borderColor;
    data.forEach((value, index) => {
      const x = padding + index * stepX;
      const y = padding + height - (value / maxValue * height) * this.animationProgress;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };
  
  Chart.prototype.drawDoughnutChart = function() {
    const ctx = this.ctx;
    const data = this.config.data.datasets[0].data;
    const colors = this.config.data.datasets[0].backgroundColor;
    const labels = this.config.data.labels;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.7;
    const total = data.reduce((sum, val) => sum + val, 0);
  
    let startAngle = 0;
    data.forEach((value, index) => {
      const angle = (value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.fillStyle = colors[index];
      ctx.arc(centerX, centerY, radius * this.animationProgress, startAngle, startAngle + angle);
      ctx.arc(centerX, centerY, radius * 0.5 * this.animationProgress, startAngle + angle, startAngle, true);
      ctx.fill();
      startAngle += angle;
    });
  
    const legendX = this.canvas.width - 90;
    const legendY = 20;
    ctx.font = '12px Segoe UI';
    ctx.textAlign = 'left';
    data.forEach((value, index) => {
      ctx.fillStyle = colors[index];
      ctx.fillRect(legendX, legendY + index * 18, 10, 10);
      ctx.fillStyle = '#495057';
      ctx.fillText(`${labels[index]}: ${value}`, legendX + 15, legendY + index * 18 + 5);
    });
  };
  
  Chart.prototype.drawBarChart = function() {
    const ctx = this.ctx;
    const data = this.config.data.datasets[0].data;
    const labels = this.config.data.labels;
    const padding = 30;
    const width = this.canvas.width - 2 * padding;
    const height = this.canvas.height - 2 * padding;
    const barWidth = (width / data.length) * 0.6;
    const maxValue = Math.max(...data);
  
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();
  
    ctx.fillStyle = '#495057';
    ctx.font = '12px Segoe UI';
    ctx.textAlign = 'right';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding + height - (i / ySteps) * height;
      const value = (i / ySteps) * maxValue;
      ctx.fillText(Math.round(value), padding - 5, y);
    }
  
    ctx.textAlign = 'center';
    for (let i = 0; i < labels.length; i++) {
      const x = padding + i * (barWidth + (width / data.length) * 0.4) + barWidth / 2;
      ctx.save();
      ctx.translate(x, padding + height + 20);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(labels[i], 0, 0);
      ctx.restore();
    }
  
    ctx.fillStyle = this.config.data.datasets[0].backgroundColor;
    data.forEach((value, index) => {
      const barHeight = (value / maxValue * height) * this.animationProgress;
      const x = padding + index * (barWidth + (width / data.length) * 0.4);
      const y = padding + height - barHeight;
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  };