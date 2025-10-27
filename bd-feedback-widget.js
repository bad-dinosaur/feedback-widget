/**
 * Bad Dinosaur Feedback Widget
 * A lightweight, embeddable feedback widget for client applications
 * Includes bundled html2canvas and annotation tools
 * 
 * Usage:
 * <script src="https://cdn.jsdelivr.net/gh/bad-dinosaur/feedback-widget@latest/bd-feedback-widget.min.js"></script>
 * <script>
 *   BDFeedback.init({
 *     projectId: 'your-project-id'
 *   });
 * </script>
 * 
 * @version 2.0.0
 */

(function(window, document) {
    'use strict';

    var html2canvasLoaded = false;
    var API_ENDPOINT = 'https://api.baddinosaur.co.uk/api/issues';
    
    function loadHtml2Canvas(callback) {
        if (typeof html2canvas !== 'undefined') {
            html2canvasLoaded = true;
            callback();
            return;
        }
        
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = function() {
            html2canvasLoaded = true;
            callback();
        };
        script.onerror = function() {
            console.error('Failed to load html2canvas');
            callback();
        };
        document.head.appendChild(script);
    }

    var STORAGE_KEY_NAME = 'bd-feedback-user-name';
    var STORAGE_KEY_EMAIL = 'bd-feedback-user-email';

    var BDFeedback = {
        config: {
            projectId: '',
            buttonPosition: 'right', // 'left', 'right', 'top', 'bottom'
            buttonColor: '#FF5722' // Orange/red color for the button
        },
        
        isOpen: false,
        screenshot: null,
        annotationMode: null,
        annotations: [],
        isDrawing: false,
        currentPath: [],
        canvas: null,
        ctx: null,
        screenshotImg: null,
        
        init: function(options) {
            this.config = Object.assign({}, this.config, options);
            
            if (!this.config.projectId) {
                console.error('BDFeedback: projectId is required');
                return;
            }
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', this.createWidget.bind(this));
            } else {
                this.createWidget();
            }
        },
        
        createWidget: function() {
            loadHtml2Canvas(function() {
                this.createStyles();
                this.createButton();
                this.createModal();
            }.bind(this));
        },
        
        createStyles: function() {
            var buttonStyles = this.getButtonStyles();
            
            var css = `
                .bd-feedback-button {
                    position: fixed;
                    ${buttonStyles.position}
                    background-color: ${this.config.buttonColor};
                    color: white;
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    z-index: 999999;
                    transition: all 0.3s ease;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    ${buttonStyles.dimensions}
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    writing-mode: ${buttonStyles.writingMode};
                    padding: 12px 16px;
                }
                
                .bd-feedback-button:hover {
                    filter: brightness(1.1);
                    transform: ${buttonStyles.hoverTransform};
                }
                
                .bd-feedback-button-icon {
                    font-size: 18px;
                }
                
                .bd-feedback-modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: rgba(0,0,0,0.9);
                    z-index: 1000000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                }
                
                .bd-feedback-modal.active {
                    display: flex;
                }
                
                .bd-feedback-modal-container {
                    display: flex;
                    width: 100%;
                    height: 100%;
                }
                
                .bd-feedback-screenshot-pane {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    overflow: hidden;
                    position: relative;
                }
                
                .bd-feedback-annotation-toolbar {
                    position: absolute;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: white;
                    border-radius: 8px;
                    padding: 8px;
                    display: flex;
                    gap: 4px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
                    z-index: 10;
                }
                
                .bd-feedback-toolbar-btn {
                    width: 36px;
                    height: 36px;
                    border: none;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    transition: all 0.2s;
                    color: #666;
                }
                
                .bd-feedback-toolbar-btn:hover {
                    background: #f0f0f0;
                }
                
                .bd-feedback-toolbar-btn.active {
                    background: #007bff;
                    color: white;
                }
                
                .bd-feedback-screenshot-container {
                    position: relative;
                    max-width: 100%;
                    max-height: calc(100% - 80px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .bd-feedback-screenshot-img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    display: block;
                }
                
                .bd-feedback-annotation-canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                    cursor: crosshair;
                }
                
                .bd-feedback-annotation-text {
                    position: absolute;
                    background: transparent;
                    border: 2px dashed #ff0000;
                    color: #ff0000;
                    font-size: 14px;
                    font-weight: bold;
                    padding: 4px 8px;
                    min-width: 100px;
                    outline: none;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    white-space: nowrap;
                }
                
                .bd-feedback-annotation-text:focus {
                    border-color: #ff0000;
                    background: rgba(255, 0, 0, 0.05);
                }
                
                .bd-feedback-form-pane {
                    width: 400px;
                    min-width: 400px;
                    background-color: white;
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                }
                
                .bd-feedback-modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #e0e0e0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background-color: white;
                }
                
                .bd-feedback-modal-title {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: #333;
                }
                
                .bd-feedback-close {
                    background: none;
                    border: none;
                    font-size: 28px;
                    cursor: pointer;
                    color: #999;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .bd-feedback-close:hover {
                    color: #333;
                }
                
                .bd-feedback-modal-body {
                    padding: 20px;
                    flex: 1;
                    overflow-y: auto;
                }
                
                .bd-feedback-form-group {
                    margin-bottom: 16px;
                }
                
                .bd-feedback-label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: #333;
                    font-size: 13px;
                }
                
                .bd-feedback-input,
                .bd-feedback-textarea,
                .bd-feedback-select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 13px;
                    font-family: inherit;
                    box-sizing: border-box;
                }
                
                .bd-feedback-textarea {
                    min-height: 100px;
                    resize: vertical;
                }
                
                .bd-feedback-input:focus,
                .bd-feedback-textarea:focus,
                .bd-feedback-select:focus {
                    outline: none;
                    border-color: ${this.config.buttonColor};
                }
                
                .bd-feedback-submit {
                    width: 100%;
                    padding: 12px;
                    background-color: ${this.config.buttonColor};
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background-color 0.3s ease;
                    position: relative;
                }
                
                .bd-feedback-submit:hover:not(:disabled) {
                    filter: brightness(1.1);
                }
                
                .bd-feedback-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                
                .bd-feedback-spinner {
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: bd-feedback-spin 0.6s linear infinite;
                    margin-right: 8px;
                }
                
                @keyframes bd-feedback-spin {
                    to { transform: rotate(360deg); }
                }
                
                .bd-feedback-message {
                    padding: 10px;
                    margin-bottom: 15px;
                    border-radius: 4px;
                    display: none;
                    font-size: 13px;
                }
                
                .bd-feedback-message.error {
                    background-color: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                    display: block;
                }
                
                .bd-feedback-info {
                    font-size: 11px;
                    color: #666;
                    margin-top: 4px;
                }
                
                @media (max-width: 768px) {
                    .bd-feedback-modal-container {
                        flex-direction: column;
                    }
                    
                    .bd-feedback-screenshot-pane {
                        height: 40%;
                    }
                    
                    .bd-feedback-form-pane {
                        width: 100%;
                        min-width: 100%;
                        height: 60%;
                    }
                }
            `;
            
            var style = document.createElement('style');
            style.type = 'text/css';
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        },
        
        getButtonStyles: function() {
            var pos = this.config.buttonPosition;
            var styles = {
                position: '',
                dimensions: '',
                writingMode: 'horizontal-tb',
                hoverTransform: 'scale(1.05)'
            };
            
            switch(pos) {
                case 'left':
                    styles.position = 'left: 0; top: 50%; transform: translateY(-50%);';
                    styles.dimensions = 'border-radius: 0 8px 8px 0;';
                    styles.writingMode = 'vertical-rl';
                    styles.hoverTransform = 'translateY(-50%) scale(1.05)';
                    break;
                case 'right':
                    styles.position = 'right: 0; top: 50%; transform: translateY(-50%);';
                    styles.dimensions = 'border-radius: 8px 0 0 8px;';
                    styles.writingMode = 'vertical-rl';
                    styles.hoverTransform = 'translateY(-50%) scale(1.05)';
                    break;
                case 'top':
                    styles.position = 'top: 0; left: 50%; transform: translateX(-50%);';
                    styles.dimensions = 'border-radius: 0 0 8px 8px;';
                    styles.hoverTransform = 'translateX(-50%) scale(1.05)';
                    break;
                case 'bottom':
                    styles.position = 'bottom: 0; left: 50%; transform: translateX(-50%);';
                    styles.dimensions = 'border-radius: 8px 8px 0 0;';
                    styles.hoverTransform = 'translateX(-50%) scale(1.05)';
                    break;
                default:
                    styles.position = 'right: 0; top: 50%; transform: translateY(-50%);';
                    styles.dimensions = 'border-radius: 8px 0 0 8px;';
                    styles.writingMode = 'vertical-rl';
                    styles.hoverTransform = 'translateY(-50%) scale(1.05)';
            }
            
            return styles;
        },
        
        createButton: function() {
            var button = document.createElement('button');
            button.className = 'bd-feedback-button';
            button.innerHTML = '<span class="bd-feedback-button-icon">✏️</span><span>Report issue</span>';
            button.setAttribute('aria-label', 'Report issue');
            button.onclick = this.openModal.bind(this);
            document.body.appendChild(button);
        },
        
        createModal: function() {
            var modal = document.createElement('div');
            modal.className = 'bd-feedback-modal';
            modal.id = 'bd-feedback-modal';
            
            var savedName = localStorage.getItem(STORAGE_KEY_NAME) || '';
            var savedEmail = localStorage.getItem(STORAGE_KEY_EMAIL) || '';
            
            modal.innerHTML = `
                <div class="bd-feedback-modal-container">
                    <div class="bd-feedback-screenshot-pane">
                        <div class="bd-feedback-annotation-toolbar">
                            <button class="bd-feedback-toolbar-btn" id="bd-feedback-text-tool" title="Add text">
                                T
                            </button>
                            <button class="bd-feedback-toolbar-btn" id="bd-feedback-draw-tool" title="Draw">
                                ✏️
                            </button>
                            <button class="bd-feedback-toolbar-btn" id="bd-feedback-clear-tool" title="Clear annotations">
                                🗑️
                            </button>
                        </div>
                        <div class="bd-feedback-screenshot-container" id="bd-feedback-screenshot-container">
                            <img id="bd-feedback-screenshot-img" class="bd-feedback-screenshot-img" src="" alt="Screenshot" />
                            <canvas id="bd-feedback-annotation-canvas" class="bd-feedback-annotation-canvas"></canvas>
                        </div>
                    </div>
                    <div class="bd-feedback-form-pane">
                        <div class="bd-feedback-modal-header">
                            <h2 class="bd-feedback-modal-title">Report Issue</h2>
                            <button class="bd-feedback-close" aria-label="Close">&times;</button>
                        </div>
                        <div class="bd-feedback-modal-body">
                            <div class="bd-feedback-message" id="bd-feedback-message"></div>
                            <form id="bd-feedback-form">
                                <div class="bd-feedback-form-group">
                                    <label class="bd-feedback-label" for="bd-feedback-title">Title *</label>
                                    <input 
                                        type="text" 
                                        id="bd-feedback-title" 
                                        class="bd-feedback-input"
                                        placeholder="Brief summary"
                                        required
                                    />
                                </div>
                                <div class="bd-feedback-form-group">
                                    <label class="bd-feedback-label" for="bd-feedback-description">Description *</label>
                                    <textarea 
                                        id="bd-feedback-description" 
                                        class="bd-feedback-textarea"
                                        placeholder="Describe the issue..."
                                        required
                                    ></textarea>
                                </div>
                                <div class="bd-feedback-form-group">
                                    <label class="bd-feedback-label" for="bd-feedback-type">Type</label>
                                    <select id="bd-feedback-type" class="bd-feedback-select">
                                        <option value="Bug">Bug</option>
                                        <option value="Change">Change</option>
                                    </select>
                                </div>
                                <div class="bd-feedback-form-group">
                                    <label class="bd-feedback-label" for="bd-feedback-priority">Priority</label>
                                    <select id="bd-feedback-priority" class="bd-feedback-select">
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                    </select>
                                </div>
                                <div class="bd-feedback-form-group">
                                    <label class="bd-feedback-label" for="bd-feedback-reporter-name">Your Name</label>
                                    <input 
                                        type="text" 
                                        id="bd-feedback-reporter-name" 
                                        class="bd-feedback-input"
                                        placeholder="John Doe"
                                        value="${savedName}"
                                    />
                                </div>
                                <div class="bd-feedback-form-group">
                                    <label class="bd-feedback-label" for="bd-feedback-reporter-email">Your Email</label>
                                    <input 
                                        type="email" 
                                        id="bd-feedback-reporter-email" 
                                        class="bd-feedback-input"
                                        placeholder="john@example.com"
                                        value="${savedEmail}"
                                    />
                                    <p class="bd-feedback-info">We'll use this to follow up</p>
                                </div>
                                <button type="submit" class="bd-feedback-submit" id="bd-feedback-submit">
                                    Report Issue
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            var closeBtn = modal.querySelector('.bd-feedback-close');
            closeBtn.onclick = this.closeModal.bind(this);
            
            modal.onclick = function(e) {
                if (e.target === modal) {
                    this.closeModal();
                }
            }.bind(this);
            
            var form = document.getElementById('bd-feedback-form');
            form.onsubmit = this.handleSubmit.bind(this);
            
            this.setupAnnotationTools();
        },
        
        setupAnnotationTools: function() {
            var textBtn = document.getElementById('bd-feedback-text-tool');
            var drawBtn = document.getElementById('bd-feedback-draw-tool');
            var clearBtn = document.getElementById('bd-feedback-clear-tool');
            
            textBtn.onclick = this.activateTextTool.bind(this);
            drawBtn.onclick = this.activateDrawTool.bind(this);
            clearBtn.onclick = this.clearAnnotations.bind(this);
        },
        
        activateTextTool: function() {
            this.annotationMode = 'text';
            document.getElementById('bd-feedback-text-tool').classList.add('active');
            document.getElementById('bd-feedback-draw-tool').classList.remove('active');
            
            var container = document.getElementById('bd-feedback-screenshot-container');
            container.style.cursor = 'text';
        },
        
        activateDrawTool: function() {
            this.annotationMode = 'draw';
            document.getElementById('bd-feedback-draw-tool').classList.add('active');
            document.getElementById('bd-feedback-text-tool').classList.remove('active');
            
            var container = document.getElementById('bd-feedback-screenshot-container');
            container.style.cursor = 'crosshair';
        },
        
        deactivateTools: function() {
            this.annotationMode = null;
            document.getElementById('bd-feedback-text-tool').classList.remove('active');
            document.getElementById('bd-feedback-draw-tool').classList.remove('active');
            
            var container = document.getElementById('bd-feedback-screenshot-container');
            container.style.cursor = 'default';
        },
        
        clearAnnotations: function() {
            if (this.ctx && this.canvas) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
            
            var container = document.getElementById('bd-feedback-screenshot-container');
            var textAnnotations = container.querySelectorAll('.bd-feedback-annotation-text');
            textAnnotations.forEach(function(el) {
                el.remove();
            });
            
            this.annotations = [];
            this.deactivateTools();
        },
        
        initializeCanvas: function() {
            var img = document.getElementById('bd-feedback-screenshot-img');
            this.canvas = document.getElementById('bd-feedback-annotation-canvas');
            this.ctx = this.canvas.getContext('2d');
            
            this.canvas.width = img.offsetWidth;
            this.canvas.height = img.offsetHeight;
            
            this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
            this.canvas.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
            this.canvas.addEventListener('mouseup', this.handleCanvasMouseUp.bind(this));
            this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        },
        
        handleCanvasMouseDown: function(e) {
            if (this.annotationMode === 'draw') {
                this.isDrawing = true;
                this.currentPath = [];
                var rect = this.canvas.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                this.currentPath.push({x: x, y: y});
            }
        },
        
        handleCanvasMouseMove: function(e) {
            if (this.isDrawing && this.annotationMode === 'draw') {
                var rect = this.canvas.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                this.currentPath.push({x: x, y: y});
                
                this.ctx.strokeStyle = '#ff0000';
                this.ctx.lineWidth = 3;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                
                this.ctx.beginPath();
                this.ctx.moveTo(this.currentPath[this.currentPath.length - 2].x, this.currentPath[this.currentPath.length - 2].y);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
            }
        },
        
        handleCanvasMouseUp: function(e) {
            if (this.isDrawing && this.annotationMode === 'draw') {
                this.isDrawing = false;
                if (this.currentPath.length > 0) {
                    this.annotations.push({
                        type: 'draw',
                        path: this.currentPath.slice()
                    });
                }
                this.currentPath = [];
            }
        },
        
        handleCanvasClick: function(e) {
            if (this.annotationMode === 'text') {
                var rect = this.canvas.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                
                this.addTextAnnotation(x, y);
            }
        },
        
        addTextAnnotation: function(x, y) {
            var container = document.getElementById('bd-feedback-screenshot-container');
            var textEl = document.createElement('div');
            textEl.className = 'bd-feedback-annotation-text';
            textEl.contentEditable = true;
            textEl.textContent = 'Write something';
            textEl.style.left = x + 'px';
            textEl.style.top = y + 'px';
            
            container.appendChild(textEl);
            
            textEl.focus();
            var range = document.createRange();
            range.selectNodeContents(textEl);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            
            textEl.addEventListener('blur', function() {
                if (textEl.textContent.trim() === '') {
                    textEl.remove();
                }
            });
            
            this.annotations.push({
                type: 'text',
                x: x,
                y: y,
                text: 'Write something',
                element: textEl
            });
        },
        
        openModal: function() {
            var modal = document.getElementById('bd-feedback-modal');
            var screenshotImg = document.getElementById('bd-feedback-screenshot-img');
            
            var messageEl = document.getElementById('bd-feedback-message');
            messageEl.className = 'bd-feedback-message';
            messageEl.textContent = '';
            
            this.captureScreenshot()
                .then(function(screenshot) {
                    this.screenshot = screenshot;
                    if (screenshot) {
                        screenshotImg.src = screenshot;
                        screenshotImg.onload = function() {
                            this.initializeCanvas();
                        }.bind(this);
                    }
                    modal.classList.add('active');
                    this.isOpen = true;
                }.bind(this))
                .catch(function(error) {
                    console.error('Error capturing screenshot:', error);
                    modal.classList.add('active');
                    this.isOpen = true;
                }.bind(this));
        },
        
        closeModal: function() {
            var modal = document.getElementById('bd-feedback-modal');
            modal.classList.remove('active');
            this.isOpen = false;
            this.screenshot = null;
            this.clearAnnotations();
            this.deactivateTools();
        },
        
        handleSubmit: function(e) {
            e.preventDefault();
            
            var submitBtn = document.getElementById('bd-feedback-submit');
            var originalText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="bd-feedback-spinner"></span>Sending...';
            
            var messageEl = document.getElementById('bd-feedback-message');
            messageEl.className = 'bd-feedback-message';
            messageEl.textContent = '';
            
            var reporterName = document.getElementById('bd-feedback-reporter-name').value;
            var reporterEmail = document.getElementById('bd-feedback-reporter-email').value;
            if (reporterName) localStorage.setItem(STORAGE_KEY_NAME, reporterName);
            if (reporterEmail) localStorage.setItem(STORAGE_KEY_EMAIL, reporterEmail);
            
            this.captureAnnotatedScreenshot()
                .then(function(annotatedScreenshot) {
                    return this.sendFeedback(annotatedScreenshot);
                }.bind(this))
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('Server responded with status: ' + response.status);
                    }
                    this.closeModal();
                    this.resetForm();
                }.bind(this))
                .catch(function(error) {
                    console.error('Error submitting feedback:', error);
                    this.showMessage('error', 'Failed to submit feedback. Please check your connection and try again.');
                }.bind(this))
                .finally(function() {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }.bind(this));
        },
        
        captureAnnotatedScreenshot: function() {
            return new Promise(function(resolve) {
                var container = document.getElementById('bd-feedback-screenshot-container');
                var img = document.getElementById('bd-feedback-screenshot-img');
                
                var tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.naturalWidth;
                tempCanvas.height = img.naturalHeight;
                var tempCtx = tempCanvas.getContext('2d');
                
                tempCtx.drawImage(img, 0, 0);
                
                var scaleX = img.naturalWidth / img.offsetWidth;
                var scaleY = img.naturalHeight / img.offsetHeight;
                
                if (this.canvas && this.ctx) {
                    tempCtx.drawImage(this.canvas, 0, 0, img.naturalWidth, img.naturalHeight);
                }
                
                var textAnnotations = container.querySelectorAll('.bd-feedback-annotation-text');
                tempCtx.font = 'bold ' + (14 * scaleX) + 'px Arial, sans-serif';
                tempCtx.fillStyle = '#ff0000';
                tempCtx.strokeStyle = '#ff0000';
                tempCtx.lineWidth = 2 * scaleX;
                
                textAnnotations.forEach(function(textEl) {
                    var x = parseInt(textEl.style.left) * scaleX;
                    var y = parseInt(textEl.style.top) * scaleY;
                    var text = textEl.textContent;
                    
                    var metrics = tempCtx.measureText(text);
                    var padding = 8 * scaleX;
                    
                    tempCtx.strokeRect(x - padding/2, y - 14 * scaleY - padding/2, 
                                      metrics.width + padding, 20 * scaleY + padding);
                    tempCtx.fillText(text, x, y);
                });
                
                resolve(tempCanvas.toDataURL('image/png'));
            }.bind(this));
        },
        
        captureScreenshot: function() {
            return new Promise(function(resolve, reject) {
                if (typeof html2canvas === 'undefined') {
                    console.warn('html2canvas not loaded');
                    resolve(null);
                    return;
                }
                
                var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                
                html2canvas(document.body, {
                    allowTaint: true,
                    useCORS: true,
                    logging: false,
                    width: viewportWidth,
                    height: viewportHeight,
                    windowWidth: viewportWidth,
                    windowHeight: viewportHeight,
                    x: window.pageXOffset || document.documentElement.scrollLeft,
                    y: window.pageYOffset || document.documentElement.scrollTop
                }).then(function(canvas) {
                    var screenshot = canvas.toDataURL('image/png');
                    resolve(screenshot);
                }).catch(function(error) {
                    console.error('html2canvas error:', error);
                    resolve(null);
                });
            });
        },
        
        collectMetadata: function() {
            var screenSize = {
                width: window.screen.width,
                height: window.screen.height,
                pixelRatio: window.devicePixelRatio || 1
            };
            
            var viewport = {
                width: window.innerWidth || document.documentElement.clientWidth,
                height: window.innerHeight || document.documentElement.clientHeight
            };
            
            var userAgent = navigator.userAgent;
            var browserName = 'Unknown';
            var browserVersion = 'Unknown';
            
            if (userAgent.indexOf('Firefox') > -1) {
                browserName = 'Firefox';
                browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
            } else if (userAgent.indexOf('Chrome') > -1) {
                browserName = 'Chrome';
                browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
            } else if (userAgent.indexOf('Safari') > -1) {
                browserName = 'Safari';
                browserVersion = userAgent.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
            } else if (userAgent.indexOf('Edge') > -1 || userAgent.indexOf('Edg') > -1) {
                browserName = 'Edge';
                browserVersion = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || 'Unknown';
            }
            
            var osFamily = 'Unknown';
            var osVersion = 'Unknown';
            
            if (userAgent.indexOf('Windows') > -1) {
                osFamily = 'Windows';
                osVersion = userAgent.match(/Windows NT ([0-9.]+)/)?.[1] || 'Unknown';
            } else if (userAgent.indexOf('Mac') > -1) {
                osFamily = 'macOS';
                osVersion = userAgent.match(/Mac OS X ([0-9._]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
            } else if (userAgent.indexOf('Linux') > -1) {
                osFamily = 'Linux';
            } else if (userAgent.indexOf('Android') > -1) {
                osFamily = 'Android';
                osVersion = userAgent.match(/Android ([0-9.]+)/)?.[1] || 'Unknown';
            } else if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) {
                osFamily = 'iOS';
                osVersion = userAgent.match(/OS ([0-9_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
            }
            
            return {
                screenSize: screenSize,
                viewport: viewport,
                browser: {
                    name: browserName,
                    version: browserVersion,
                    userAgent: userAgent
                },
                operatingSystem: {
                    family: osFamily,
                    version: osVersion
                },
                url: window.location.href,
                pageTitle: document.title,
                domain: window.location.hostname
            };
        },
        
        sendFeedback: function(screenshot) {
            var metadata = this.collectMetadata();
            
            var title = document.getElementById('bd-feedback-title').value;
            var description = document.getElementById('bd-feedback-description').value;
            var type = document.getElementById('bd-feedback-type').value;
            var priority = document.getElementById('bd-feedback-priority').value;
            var reporterName = document.getElementById('bd-feedback-reporter-name').value || 'Anonymous';
            var reporterEmail = document.getElementById('bd-feedback-reporter-email').value || '';
            
            var contextString = 'Browser: ' + metadata.browser.name + ' ' + metadata.browser.version + '\n';
            contextString += 'OS: ' + metadata.operatingSystem.family + ' ' + metadata.operatingSystem.version + '\n';
            contextString += 'Screen: ' + metadata.screenSize.width + 'x' + metadata.screenSize.height + '\n';
            contextString += 'Viewport: ' + metadata.viewport.width + 'x' + metadata.viewport.height;
            
            var payload = {
                ProjectId: this.config.projectId, // should be a GUID string
                Priority: priority, // should match IssuePriority enum values
                Type: type,         // should match IssueType enum values
                Title: title,
                Description: description,
                ReportedBy: reporterName,
                ScreensizeWidth: metadata.screenSize.width,
                ScreensizeHeight: metadata.screenSize.height,
                ScreensizePixelRatio: metadata.screenSize.pixelRatio,
                OSFamily: metadata.operatingSystem.family,
                OSVersion: metadata.operatingSystem.version,
                BrowserName: metadata.browser.name,
                BrowserVersion: metadata.browser.version,
                BrowserUserAgent: metadata.browser.userAgent,
                ViewportWidth: metadata.viewport.width,
                ViewportHeight: metadata.viewport.height,
                ZoomFactor: metadata.zoom ? metadata.zoom.zoomFactor : (window.devicePixelRatio || 1),
                Url: metadata.url,
                PageTitle: metadata.pageTitle,
                Domain: metadata.domain,
                ScreenshotUrl: screenshot || this.screenshot
            };
            
            return fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        },
        
        showMessage: function(type, message) {
            var messageEl = document.getElementById('bd-feedback-message');
            messageEl.className = 'bd-feedback-message ' + type;
            messageEl.textContent = message;
        },
        
        resetForm: function() {
            document.getElementById('bd-feedback-title').value = '';
            document.getElementById('bd-feedback-description').value = '';
            document.getElementById('bd-feedback-type').selectedIndex = 0;
            document.getElementById('bd-feedback-priority').selectedIndex = 0;
        }
    };
    
    window.BDFeedback = BDFeedback;
    
})(window, document);
