// Enhanced chart.js with professional features
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
    const padding = 10;
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
            const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
            if (distance < 10) {
                this.tooltip = {
                    visible: true,
                    x: x + 15,
                    y: y - 15,
                    text: `${labels[i]}: ${data[i]} minutes`
                };
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
                this.tooltip = {
                    visible: true,
                    x: mouseX + 15,
                    y: mouseY - 15,
                    text: `${labels[i]}: ${data[i]} minutes`
                };
                break;
            }
            startAngle = endAngle;
        }
    } else if (this.config.type === 'bar') {
        const data = this.config.data.datasets[0].data;
        const labels = this.config.data.labels;
        const barWidth = (width / data.length) * 0.8;
        const maxValue = Math.max(...data);

        for (let i = 0; i < data.length; i++) {
            const x = padding + i * (barWidth + (width / data.length) * 0.2);
            const barHeight = (data[i] / maxValue * height) * this.animationProgress;
            const y = padding + height - barHeight;
            if (mouseX >= x && mouseX <= x + barWidth && mouseY >= y && mouseY <= padding + height) {
                this.tooltip = {
                    visible: true,
                    x: x + barWidth / 2,
                    y: y - 15,
                    text: `${labels[i]}: ${data[i]} minutes`
                };
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
        if (this.animationProgress < 1) {
            requestAnimationFrame(animateFrame);
        }
    };

    requestAnimationFrame(animateFrame);
};

Chart.prototype.draw = function() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.config.type === 'line') {
        this.drawLineChart();
    } else if (this.config.type === 'doughnut') {
        this.drawDoughnutChart();
    } else if (this.config.type === 'bar') {
        this.drawBarChart();
    }

    if (this.tooltip.visible) {
        ctx.fillStyle = '#2c3e50';
        ctx.font = '12px Segoe UI';
        const textWidth = ctx.measureText(this.tooltip.text).width;
        ctx.fillRect(this.tooltip.x, this.tooltip.y - 15, textWidth + 10, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.tooltip.text, this.tooltip.x + 5, this.tooltip.y - 2);
    }
};

Chart.prototype.drawLineChart = function() {
    const ctx = this.ctx;
    const data = this.config.data.datasets[0].data;
    const labels = this.config.data.labels;
    const padding = 40;
    const width = this.canvas.width - 2 * padding;
    const height = this.canvas.height - 2 * padding;
    const maxValue = Math.max(...data);
    const stepX = width / (labels.length - 1);

    // Draw axes
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#2c3e50';
    ctx.font = '12px Segoe UI';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
        const y = padding + height - (i / ySteps) * height;
        const value = (i / ySteps) * maxValue;
        ctx.fillText(Math.round(value) + 'm', padding - 10, y);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();
    }

    // Draw X-axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i < labels.length; i++) {
        const x = padding + i * stepX;
        ctx.fillText(labels[i], x, padding + height + 20);
    }

    // Draw line
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

    // Draw points and labels
    ctx.fillStyle = this.config.data.datasets[0].borderColor;
    data.forEach((value, index) => {
        const x = padding + index * stepX;
        const y = padding + height - (value / maxValue * height) * this.animationProgress;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'center';
        ctx.fillText(value + 'm', x, y - 15);
        ctx.fillStyle = this.config.data.datasets[0].borderColor;
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
    
    // Draw doughnut
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

    // Draw legend
    const legendX = this.canvas.width - 100;
    const legendY = 20;
    ctx.font = '12px Segoe UI';
    ctx.textAlign = 'left';
    data.forEach((value, index) => {
        ctx.fillStyle = colors[index];
        ctx.fillRect(legendX, legendY + index * 20, 10, 10);
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(`${labels[index]}: ${value}m`, legendX + 20, legendY + index * 20 + 5);
    });
};

Chart.prototype.drawBarChart = function() {
    const ctx = this.ctx;
    const data = this.config.data.datasets[0].data;
    const labels = this.config.data.labels;
    const padding = 40;
    const width = this.canvas.width - 2 * padding;
    const height = this.canvas.height - 2 * padding;
    const barWidth = (width / data.length) * 0.8;
    const maxValue = Math.max(...data);

    // Draw axes
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#2c3e50';
    ctx.font = '12px Segoe UI';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
        const y = padding + height - (i / ySteps) * height;
        const value = (i / ySteps) * maxValue;
        ctx.fillText(Math.round(value) + 'm', padding - 10, y);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();
    }

    // Draw X-axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i < labels.length; i++) {
        const x = padding + i * (barWidth + (width / data.length) * 0.2) + barWidth / 2;
        ctx.fillText(labels[i], x, padding + height + 20);
    }

    // Draw bars
    ctx.fillStyle = this.config.data.datasets[0].backgroundColor;
    data.forEach((value, index) => {
        const barHeight = (value / maxValue * height) * this.animationProgress;
        const x = padding + index * (barWidth + (width / data.length) * 0.2);
        const y = padding + height - barHeight;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(value + 'm', x + barWidth / 2, y - 10);
        ctx.fillStyle = this.config.data.datasets[0].backgroundColor;
    });
};