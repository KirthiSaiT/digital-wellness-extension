// Simplified chart.js substitute (for testing only)
window.Chart = function(canvasContext, config) {
    this.ctx = canvasContext;
    this.config = config;
    this.draw();
};

Chart.prototype.destroy = function() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
};

Chart.prototype.draw = function() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    if (this.config.type === 'line') {
        this.drawLineChart();
    } else if (this.config.type === 'doughnut') {
        this.drawDoughnutChart();
    } else if (this.config.type === 'bar') {
        this.drawBarChart();
    }
};

Chart.prototype.drawLineChart = function() {
    const ctx = this.ctx;
    const data = this.config.data.datasets[0].data;
    const labels = this.config.data.labels;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    ctx.beginPath();
    ctx.strokeStyle = this.config.data.datasets[0].borderColor;
    const maxValue = Math.max(...data);
    const stepX = width / (labels.length - 1);
    
    data.forEach((value, index) => {
        const x = index * stepX;
        const y = height - (value / maxValue * height);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
};

Chart.prototype.drawDoughnutChart = function() {
    const ctx = this.ctx;
    const data = this.config.data.datasets[0].data;
    const colors = this.config.data.datasets[0].backgroundColor;
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.7;
    
    let startAngle = 0;
    const total = data.reduce((sum, val) => sum + val, 0);
    
    data.forEach((value, index) => {
        const angle = (value / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.fillStyle = colors[index];
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
        ctx.arc(centerX, centerY, radius * 0.5, startAngle + angle, startAngle, true);
        ctx.fill();
        startAngle += angle;
    });
};

Chart.prototype.drawBarChart = function() {
    const ctx = this.ctx;
    const data = this.config.data.datasets[0].data;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const barWidth = width / data.length * 0.8;
    const maxValue = Math.max(...data);
    
    ctx.fillStyle = this.config.data.datasets[0].backgroundColor;
    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * height;
        const x = index * (barWidth + (width / data.length * 0.2));
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
    });
};

// Save this as chart.min.js for basic testing