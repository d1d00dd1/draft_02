import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { audioEngine } from '../services/AudioEngine';

function Visualizer() {
    const containerRef = useRef<HTMLDivElement>(null);
    const p5Instance = useRef<p5 | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const sketch = (p: p5) => {
            const fontSize = 20;
            let cols: number, rows: number, size: number;
            
            let zBuffer: Float32Array;
            let gridChars: string[];
            let gridColors: Uint8ClampedArray; 
            let gridMeta: Uint8Array;
            let gridGlow: Float32Array;     
            let floatingAscii: any[] = [];
            let floatingPetals: any[] = [];
            let ripples: any[] = [];
            let glitchOffset: Int16Array;
            let cachedRippleIntensity = 0;
            let rippleZones: Map<number, Set<number>> = new Map();
            let maxRippleRadiusSq = 0;
            let handDistance = 0.5;
            let charVelX: Float32Array;
            let charVelY: Float32Array;
            let charAccelX: Float32Array;
            let charAccelY: Float32Array;
            let charBaseX: Float32Array;
            let charBaseY: Float32Array;
            let physicsParticles: any[] = [];
            let videoColors: Array<{r: number, g: number, b: number}> = [];
            let videoColorUpdateTimer = 0;

            const EMPTY_CHAR = "空";

            const baseColors = [
                { r: 180, g: 200, b: 255 },
                { r: 200, g: 180, b: 255 },
                { r: 255, g: 200, b: 220 },
                { r: 220, g: 255, b: 200 },
                { r: 200, g: 255, b: 255 },
                { r: 255, g: 220, b: 200 }
            ];

            let capture: p5.Element;
            let prevPixels: Uint8ClampedArray | null = null;
            let motionThreshold = 30; 
            let lastMotionTime = 0;
            let flowX = 0; 
            let flowY = 0; 
            let shakeAccumulator = 0; 
            let lastFlowX = 0;
            let zoomLevel = 1.0;
            let targetZoom = 1.0;
            let glitchRows: Int16Array; 
            let glitchUpdateTimer = 0;
            let viewportDriftX = 0;
            let viewportDriftY = 0;
            let stutterActive = false;
            let stutterDuration = 0;
            let colorShift = 0;
            let colorShiftTarget = 0;
            let effectMode = 0;
            let effectTimer = 0;
            let randomWavePhase = Math.random() * Math.PI * 2;
            let blockGlitch = { x: 0, y: 0, w: 0, h: 0, offX: 0, offY: 0 };
            let leftHandY = 0.5;
            let rightHandY = 0.5;
            let leftHandActive = false;
            let rightHandActive = false;
            let rotX = 0, rotY = 0;
            let targetRotX = 0, targetRotY = 0;
            let cameraInitialized = false;
            let motionFrameSkip = 0;
            let touchX = 0;
            let touchY = 0;
            let isDragging = false;
            let detectedFingers = 0;
            let lastFingerCount = 0;
            let fingerCountStable = 0;
            
            const initCamera = async () => {
                if (cameraInitialized) return;
                try {
                    await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    capture = p.createCapture(p.VIDEO);
                    capture.size(120, 90);
                    capture.hide();
                } catch (e) {}
                cameraInitialized = true;
            };
            
            p.setup = () => {
                p.createCanvas(p.windowWidth, p.windowHeight);
                const ctx = p.drawingContext as CanvasRenderingContext2D;
                ctx.font = `bold ${fontSize}px "Space Mono", monospace`;
                ctx.imageSmoothingEnabled = false;
                p.textAlign(p.CENTER, p.CENTER);
                p.noStroke();
                p.frameRate(60);
                p.resizeCanvas(p.windowWidth, p.windowHeight);
                
                const canvas = p.canvas as HTMLCanvasElement;
                canvas.style.willChange = 'contents';
                canvas.style.transform = 'translateZ(0)';

                calculateGrid();
            };

            p.windowResized = () => {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
                const ctx = p.drawingContext as CanvasRenderingContext2D;
                ctx.imageSmoothingEnabled = false;
                calculateGrid();
            };

            (p as any).touchStarted = () => {
                initCamera();
                touchX = p.mouseX / p.width;
                touchY = p.mouseY / p.height;
                isDragging = true;
                
                if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
                    audioEngine.ctx.resume();
                }
                audioEngine.triggerInteraction();
                updateGlitchMap(true);
                audioEngine.setChaos(1.0);
                
                if (ripples.length >= 3) {
                    ripples.sort((a, b) => a.life - b.life);
                    ripples.shift();
                }
                
                ripples.push({
                    x: p.mouseX,
                    y: p.mouseY,
                    radius: 30,
                    life: 0,
                    maxLife: 50 + Math.random() * 15,
                    strength: 1.2 + Math.random() * 0.3,
                    velocity: 10 + Math.random() * 5,
                    amplitude: 10 + Math.random() * 6,
                    phase: Math.random() * Math.PI * 2,
                    frequency: 0.25 + Math.random() * 0.15,
                    interference: Math.random() * 0.5
                });
                updateRippleZones();
                cachedRippleIntensity = -1;

                if (floatingAscii.length < 15) {
                    for(let i = 0; i < 2; i++) {
                        floatingAscii.push({
                            x: p.mouseX,
                            y: p.mouseY,
                            char: EMPTY_CHAR,
                            life: 45,
                            vx: (Math.random() - 0.5) * 6,
                            vy: (Math.random() - 0.5) * 6 - 1.5
                        });
                    }
                }
                return false; 
            };

            (p as any).touchMoved = () => {
                if (!isDragging) return false;
                touchX = p.mouseX / p.width;
                touchY = p.mouseY / p.height;
                leftHandY = touchY;
                rightHandY = touchY;
                leftHandActive = true;
                rightHandActive = true;
                targetRotX = (touchY - 0.5) * 4;
                targetRotY = (touchX - 0.5) * 4;
                audioEngine.setChaos(Math.min(1.0, 0.5 + Math.abs(touchX - 0.5) + Math.abs(touchY - 0.5)));
                audioEngine.updateSpatialParams(touchY, touchY, 0);
                updateGlitchMap(false);
                return false;
            };

            (p as any).touchEnded = () => {
                isDragging = false;
                leftHandActive = false;
                rightHandActive = false;
                return false;
            };

            p.mousePressed = () => {
                initCamera();
                touchX = p.mouseX / p.width;
                touchY = p.mouseY / p.height;
                isDragging = true;
                
                if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
                    audioEngine.ctx.resume();
                }
                audioEngine.triggerInteraction();
                updateGlitchMap(true);
                audioEngine.setChaos(1.0);
                
                if (ripples.length >= 3) {
                    ripples.sort((a, b) => a.life - b.life);
                    ripples.shift();
                }
                
                ripples.push({
                    x: p.mouseX,
                    y: p.mouseY,
                    radius: 30,
                    life: 0,
                    maxLife: 50 + Math.random() * 15,
                    strength: 1.2 + Math.random() * 0.3,
                    velocity: 10 + Math.random() * 5,
                    amplitude: 10 + Math.random() * 6,
                    phase: Math.random() * Math.PI * 2,
                    frequency: 0.25 + Math.random() * 0.15,
                    interference: Math.random() * 0.5
                });
                updateRippleZones();
                cachedRippleIntensity = -1;
                
                if (floatingAscii.length < 15) {
                    for(let i = 0; i < 2; i++) {
                        floatingAscii.push({
                            x: p.mouseX,
                            y: p.mouseY,
                            char: EMPTY_CHAR,
                            life: 40,
                            vx: (Math.random() - 0.5) * 5,
                            vy: (Math.random() - 0.5) * 5 - 1.5
                        });
                    }
                }
            };

            p.mouseDragged = () => {
                if (!isDragging) return;
                touchX = p.mouseX / p.width;
                touchY = p.mouseY / p.height;
                leftHandY = touchY;
                rightHandY = touchY;
                leftHandActive = true;
                rightHandActive = true;
                targetRotX = (touchY - 0.5) * 4;
                targetRotY = (touchX - 0.5) * 4;
                audioEngine.setChaos(Math.min(1.0, 0.5 + Math.abs(touchX - 0.5) + Math.abs(touchY - 0.5)));
                audioEngine.updateSpatialParams(touchY, touchY, 0);
                updateGlitchMap(false);
            };

            p.mouseReleased = () => {
                isDragging = false;
                leftHandActive = false;
                rightHandActive = false;
            };

            p.mouseClicked = () => {
                initCamera();
                if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
                    audioEngine.ctx.resume();
                }
                audioEngine.triggerInteraction();
                updateGlitchMap(true);
                audioEngine.setChaos(1.0);
            };

            const calculateGrid = () => {
                cols = Math.ceil(p.width / fontSize) + 2;
                rows = Math.ceil(p.height / (fontSize * 0.65)) + 2; 
                size = cols * rows;
                
                zBuffer = new Float32Array(size);
                gridChars = new Array(size).fill("");
                gridColors = new Uint8ClampedArray(size * 3);
                gridMeta = new Uint8Array(size);
                gridGlow = new Float32Array(size);
                glitchOffset = new Int16Array(size).fill(0);
                charVelX = new Float32Array(size).fill(0);
                charVelY = new Float32Array(size).fill(0);
                charAccelX = new Float32Array(size).fill(0);
                charAccelY = new Float32Array(size).fill(0);
                charBaseX = new Float32Array(size);
                charBaseY = new Float32Array(size);

                for (let i = 0; i < size; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    charBaseX[i] = col * fontSize;
                    charBaseY[i] = row * (fontSize * 0.65);
                }
                
                glitchRows = new Int16Array(rows).fill(0);
            };

            function extractVideoColors() {
                if (!capture || !capture.width) return;
                
                try {
                    (capture as any).loadPixels();
                    const pixels = (capture as any).pixels;
                    if (!pixels || pixels.length === 0) return;
                    
                    const w = capture.width;
                    const h = capture.height;
                    const sampleSize = 8;
                    const colorBuckets: Map<string, {r: number, g: number, b: number, count: number}> = new Map();
                    
                    for (let y = 0; y < h; y += sampleSize) {
                        for (let x = 0; x < w; x += sampleSize) {
                            const idx = (y * w + x) * 4;
                            if (idx + 2 >= pixels.length) continue;
                            
                            const r = pixels[idx];
                            const g = pixels[idx + 1];
                            const b = pixels[idx + 2];
                            const brightness = (r + g + b) / 3;
                            
                            if (brightness < 30 || brightness > 240) continue;
                            
                            const quantizedR = Math.floor(r / 32) * 32;
                            const quantizedG = Math.floor(g / 32) * 32;
                            const quantizedB = Math.floor(b / 32) * 32;
                            const key = `${quantizedR},${quantizedG},${quantizedB}`;
                            
                            if (colorBuckets.has(key)) {
                                const bucket = colorBuckets.get(key)!;
                                bucket.r = (bucket.r * bucket.count + r) / (bucket.count + 1);
                                bucket.g = (bucket.g * bucket.count + g) / (bucket.count + 1);
                                bucket.b = (bucket.b * bucket.count + b) / (bucket.count + 1);
                                bucket.count++;
                            } else {
                                colorBuckets.set(key, { r, g, b, count: 1 });
                            }
                        }
                    }
                    
                    const sorted = Array.from(colorBuckets.values())
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 6);
                    
                    if (sorted.length > 0) {
                        videoColors = sorted.map(c => ({
                            r: Math.min(255, c.r * 1.2),
                            g: Math.min(255, c.g * 1.1),
                            b: Math.min(255, c.b * 1.3)
                        }));
                    }
                } catch (e) {}
            }

            function updateRippleZones() {
                rippleZones.clear();
                maxRippleRadiusSq = 0;
                
                for (let i = 0; i < ripples.length; i++) {
                    const ripple = ripples[i];
                    const maxRadius = ripple.radius * 3.5;
                    const maxRadiusSq = maxRadius * maxRadius;
                    maxRippleRadiusSq = Math.max(maxRippleRadiusSq, maxRadiusSq);
                    
                    const minCol = Math.max(0, Math.floor((ripple.x - maxRadius) / fontSize) - 2);
                    const maxCol = Math.min(cols - 1, Math.ceil((ripple.x + maxRadius) / fontSize) + 2);
                    const minRow = Math.max(0, Math.floor((ripple.y - maxRadius) / (fontSize * 0.65)) - 2);
                    const maxRow = Math.min(rows - 1, Math.ceil((ripple.y + maxRadius) / (fontSize * 0.65)) + 2);
                    
                    const zone = new Set<number>();
                    for (let row = minRow; row <= maxRow; row++) {
                        for (let col = minCol; col <= maxCol; col++) {
                            const idx = row * cols + col;
                            if (idx >= 0 && idx < size) {
                                const cellX = col * fontSize;
                                const cellY = row * (fontSize * 0.65);
                                const distSq = (cellX - ripple.x) ** 2 + (cellY - ripple.y) ** 2;
                                if (distSq < maxRadiusSq) {
                                    zone.add(idx);
                                }
                            }
                        }
                    }
                    rippleZones.set(i, zone);
                }
            }

            function updateGlitchMap(force = false) {
                if (!glitchRows || !glitchRows.length) return;

                const chaos = audioEngine.chaos;
                const baseRate = 40 + Math.random() * 40;
                const rate = Math.max(15, baseRate - chaos * 30);
                if (!force && p.millis() - glitchUpdateTimer < rate) return;
                glitchUpdateTimer = p.millis();

                if (Math.random() > 0.2 + chaos * 0.3) glitchRows.fill(0);

                const sliceVariation = Math.random() > 0.5 ? 1.5 : 0.5;
                const slices = Math.floor((Math.random() * 25 + chaos * 15) * sliceVariation);
                for(let i = 0; i < slices; i++) {
                    const start = Math.floor(Math.random() * rows);
                    const len = Math.floor(Math.random() * rows / (2 + Math.random() * 2) + 3);
                    const offset = Math.floor((Math.random() - 0.5) * (200 + chaos * 100));
                    for(let r = start; r < Math.min(rows, start + len); r++) {
                        glitchRows[r] = offset;
                    }
                }
                
                if (Math.random() > 0.3 + chaos * 0.2) {
                    blockGlitch = {
                        x: Math.floor(Math.random() * cols),
                        y: Math.floor(Math.random() * rows),
                        w: Math.floor(Math.random() * (40 + chaos * 30) + 8),
                        h: Math.floor(Math.random() * (40 + chaos * 30) + 8),
                        offX: Math.floor((Math.random() - 0.5) * (100 + chaos * 50)),
                        offY: Math.floor((Math.random() - 0.5) * (100 + chaos * 50))
                    };
                } else {
                    blockGlitch = { x:0, y:0, w:0, h:0, offX:0, offY:0 };
                }
            }

            function detectFingerCount(motionPoints: Array<{x: number, y: number}>): number {
                if (motionPoints.length < 3) return 0;
                
                const clusters: Array<{x: number, y: number, points: number}> = [];
                const clusterRadius = 15;
                
                for (const point of motionPoints) {
                    let foundCluster = false;
                    for (const cluster of clusters) {
                        const dist = Math.sqrt((point.x - cluster.x) ** 2 + (point.y - cluster.y) ** 2);
                        if (dist < clusterRadius) {
                            cluster.x = (cluster.x * cluster.points + point.x) / (cluster.points + 1);
                            cluster.y = (cluster.y * cluster.points + point.y) / (cluster.points + 1);
                            cluster.points++;
                            foundCluster = true;
                            break;
                        }
                    }
                    if (!foundCluster) {
                        clusters.push({ x: point.x, y: point.y, points: 1 });
                    }
                }
                
                const significantClusters = clusters.filter(c => c.points >= 2);
                const fingerEstimate = Math.min(5, Math.max(0, Math.floor(significantClusters.length * 0.8)));
                
                return fingerEstimate;
            }

            function processMotion() {
                if (!capture || !capture.width) return;

                motionFrameSkip++;
                if (motionFrameSkip % 8 !== 0) return;
                
                try {
                    (capture as any).loadPixels();
                    const currentPixels = (capture as any).pixels; 
                    if (!currentPixels || currentPixels.length === 0) return;

                    if (!prevPixels || prevPixels.length !== currentPixels.length) {
                        prevPixels = new Uint8ClampedArray(currentPixels);
                        return;
                    }

                    const w = capture.width;
                    const h = capture.height;
                    
                    let totalMotion = 0;
                    let sumMotionX = 0;
                    let sumMotionY = 0;
                    let leftMotionY = 0, leftCount = 0;
                    let rightMotionY = 0, rightCount = 0;
                    const motionPoints: Array<{x: number, y: number}> = [];

                    const sampleStep = 64;
                    
                    for (let i = 0; i < currentPixels.length; i += 4 * sampleStep) { 
                        const bright = currentPixels[i]; 
                        const prevBright = prevPixels[i];
                        
                        if (Math.abs(bright - prevBright) > motionThreshold) {
                            totalMotion++;
                            const pixelIdx = i / 4;
                            const x = pixelIdx % w;
                            const y = Math.floor(pixelIdx / w);

                            sumMotionX += (x - w/2); 
                            sumMotionY += (y - h/2);
                            
                            motionPoints.push({ x, y });

                            if (x < w / 2) {
                                leftMotionY += y;
                                leftCount++;
                            } else {
                                rightMotionY += y;
                                rightCount++;
                            }
                        }
                        prevPixels[i] = bright; 
                    }
                    
                    const fingerCount = detectFingerCount(motionPoints);
                    if (fingerCount === lastFingerCount) {
                        fingerCountStable++;
                    } else {
                        fingerCountStable = 0;
                    }
                    lastFingerCount = fingerCount;
                    
                    if (fingerCountStable > 3) {
                        detectedFingers = fingerCount;
                    }

                    const motionRatio = totalMotion / ((w * h) / sampleStep); 
                    
                    if (totalMotion > 5) {
                        const avgX = (sumMotionX / totalMotion) / (w/2); 
                        const avgY = (sumMotionY / totalMotion) / (h/2); 
                        
                        flowX = p.lerp(flowX, avgX, 0.3);
                        flowY = p.lerp(flowY, avgY, 0.3);
                        
                        if (Math.sign(flowX) !== Math.sign(lastFlowX) && Math.abs(flowX - lastFlowX) > 0.4) {
                            shakeAccumulator += 1;
                        }
                        lastFlowX = flowX;

                        const motionIntensity = Math.min(1, motionRatio * 3);
                        handDistance = p.lerp(handDistance, 1 - motionIntensity, 0.15);

                        if (leftCount > 5) {
                            leftHandActive = true;
                            leftHandY = p.lerp(leftHandY, 1 - ((leftMotionY/leftCount)/h), 0.2);
                        } else leftHandActive = false;

                        if (rightCount > 5) {
                            rightHandActive = true;
                            rightHandY = p.lerp(rightHandY, 1 - ((rightMotionY/rightCount)/h), 0.2);
                        } else rightHandActive = false;

                        if (leftHandActive || rightHandActive) {
                            targetZoom = p.map(handDistance, 0, 1, 0.3, 3.0);
                        } else {
                             targetZoom = 1.0;
                            handDistance = p.lerp(handDistance, 0.5, 0.1);
                        }

                        lastMotionTime = p.millis();
                        audioEngine.setPresence(true);
                        
                        const chaosLevel = Math.min(1, motionRatio * 5); 
                        audioEngine.setChaos(chaosLevel);

                    } else {
                        flowX = p.lerp(flowX, 0, 0.1);
                        flowY = p.lerp(flowY, 0, 0.1);
                        targetZoom = 1.0;
                        shakeAccumulator = Math.max(0, shakeAccumulator - 0.2);
                        
                        if (p.millis() - lastMotionTime > 800) { 
                            audioEngine.setPresence(false);
                            audioEngine.setChaos(0);
                        }
                    }

                    if (shakeAccumulator > 3.0) {
                        shakeAccumulator = 0;
                        audioEngine.triggerModeSwitch();
                        updateGlitchMap(true);
                        effectMode = Math.floor(Math.random() * 6);
                        effectTimer = 0;
                        randomWavePhase = Math.random() * Math.PI * 2;
                    }

                    audioEngine.updateSpatialParams(leftHandY, rightHandY, 0);

                } catch (e) {}
            }

            function getColor(t: number, kick: number, chaos: number) {
                const palette = videoColors.length > 0 ? videoColors : baseColors;
                const speed = 0.12 + chaos * 0.08;
                const idx = Math.floor(t * speed % palette.length);
                const next = (idx + 1) % palette.length;
                const blend = (t * speed) % 1;
                
                const dreamyWave = Math.sin(t * 1.2) * 0.4 + 0.6;
                const chaosWave = Math.sin(t * 1.8 + chaos * 2) * 0.3 + 0.7;
                const slowWave = Math.sin(t * 0.5) * 0.2 + 0.8;

                let r = p.lerp(palette[idx].r, palette[next].r, blend);
                let g = p.lerp(palette[idx].g, palette[next].g, blend);
                let b = p.lerp(palette[idx].b, palette[next].b, blend);
                
                r *= dreamyWave * chaosWave * slowWave;
                g *= dreamyWave * chaosWave * slowWave;
                b *= dreamyWave * chaosWave * slowWave;

                if (kick > 0.4) {
                    const pulse = Math.sin(t * 6 + chaos) * 0.2 + 0.8;
                    r *= pulse;
                    g *= pulse;
                    b *= pulse;
                }
                
                const saturation = 1.1 + chaos * 0.2;
                const avg = (r + g + b) / 3;
                r = avg + (r - avg) * saturation;
                g = avg + (g - avg) * saturation;
                b = avg + (b - avg) * saturation;

                return {
                    r: Math.max(80, Math.min(255, r)),
                    g: Math.max(80, Math.min(255, g)),
                    b: Math.max(100, Math.min(255, b))
                };
            }

            p.draw = () => {
                try {
                    const chaos = audioEngine.chaos;
                    
                    let bass = 0, mid = 0, high = 0;
                    let kickVol = 0;
                    let globalTime = 0;
                    
                    if (audioEngine.isSetup && audioEngine.analyser && audioEngine.ctx) {
                        const data = new Uint8Array(audioEngine.analyser.frequencyBinCount);
                        audioEngine.analyser.getByteFrequencyData(data);
                        bass = data[2] / 255.0; 
                        kickVol = (data[2] + data[4] + data[6]) / 3 / 255.0;
                        mid = data[40] / 255.0; 
                        high = data[100] / 255.0; 
                        globalTime = audioEngine.ctx.currentTime;
                    } else {
                        globalTime = p.millis() / 1000;
                    }

                    effectTimer++;
                    if (effectTimer > 30 + Math.random() * 120) {
                        effectMode = Math.floor(Math.random() * 6);
                        effectTimer = 0;
                        randomWavePhase = Math.random() * Math.PI * 2;
                        colorShiftTarget = (Math.random() - 0.5) * 0.3;
                    }
                    
                    colorShift = p.lerp(colorShift, colorShiftTarget, 0.05);

                    if (stutterActive) {
                        stutterDuration--;
                        if (stutterDuration <= 0) stutterActive = false;
                    } else {
                        const stutterChance = (chaos > 0.85 && kickVol > 0.85 && p.random() < 0.02);
                        if (stutterChance) {
                            stutterActive = true;
                            stutterDuration = 1;

                            for(let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
                                floatingAscii.push({
                                    x: Math.random() * p.width,
                                    y: Math.random() * p.height,
                                    char: EMPTY_CHAR,
                                    life: 20 + Math.random() * 15,
                                    vx: (Math.random() - 0.5) * (8 + chaos * 4),
                                    vy: (Math.random() - 0.5) * (8 + chaos * 4)
                                });
                            }
                        }
                    }
                    
                    floatingAscii = floatingAscii.filter(f => {
                        f.x += f.vx;
                        f.y += f.vy;
                        f.vy += 0.2;
                        f.life--;
                        return f.life > 0 && f.x > -50 && f.x < p.width + 50 && f.y > -50 && f.y < p.height + 50;
                    });

                    const prevRippleCount = ripples.length;
                    ripples = ripples.filter(ripple => {
                        ripple.life++;
                        ripple.radius += ripple.velocity;
                        ripple.velocity *= 0.995;
                        ripple.strength *= 0.98;
                        ripple.phase += 0.2;
                        return ripple.life < ripple.maxLife && ripple.radius < p.width + p.height;
                    });
                    
                    if (ripples.length !== prevRippleCount || ripples.length > 0) {
                        updateRippleZones();
                        cachedRippleIntensity = -1;
                    }

                    const shakeAmt = (bass * 0.1) + (chaos * 0.2);
                    targetRotX += (p.random(-shakeAmt, shakeAmt));
                    targetRotY += (p.random(-shakeAmt, shakeAmt));

                    if (!stutterActive) {
                        processMotion();
                        
                        if (p.millis() - videoColorUpdateTimer > 500) {
                            extractVideoColors();
                            videoColorUpdateTimer = p.millis();
                        }
                        
                        p.background(0);
                        
                        if (leftHandActive) {
                            targetRotY = (leftHandY - 0.5) * 4;
                        } else {
                            targetRotY *= 0.92;
                        }
                        
                        if (rightHandActive) {
                            targetRotX = (rightHandY - 0.5) * 4;
                        } else {
                            const idlePhase = globalTime * (0.3 + Math.random() * 0.4);
                            targetRotX = Math.sin(idlePhase) * (0.2 + Math.random() * 0.2);
                        }
                        
                        const effectIntensity = chaos * 0.5 + kickVol * 0.3;
                        const randomPhase = globalTime * (0.5 + Math.random() * 2) + randomWavePhase;
                        
                        if (effectMode === 0) {
                            targetRotX += Math.sin(randomPhase) * (0.3 + effectIntensity * 0.4);
                            targetRotY += Math.cos(randomPhase) * (0.3 + effectIntensity * 0.4);
                            zoomLevel = 0.9 + Math.sin(randomPhase * 1.3) * 0.2;
                            targetZoom = zoomLevel;
                        } else if (effectMode === 1) {
                            const waveFreq = 2 + Math.random() * 3;
                            viewportDriftX += Math.sin(globalTime * waveFreq) * (2 + effectIntensity * 3);
                            viewportDriftY += Math.cos(globalTime * waveFreq * 1.3) * (2 + effectIntensity * 3);
                            for(let i = 0; i < size; i += Math.floor(size / (40 + Math.random() * 30))) {
                                if (gridChars[i] && Math.random() > 0.3) {
                                    const waveOffset = Math.sin((i / size) * Math.PI * 4 + randomPhase) * (15 + effectIntensity * 20);
                                    glitchOffset[i] = Math.floor(waveOffset);
                                }
                            }
                        } else if (effectMode === 2) {
                            const pulse = Math.sin(randomPhase * 2) * 0.5 + 0.5;
                            zoomLevel = 0.7 + pulse * 0.6 + effectIntensity * 0.4;
                            targetZoom = zoomLevel;
                            targetRotX += (Math.random() - 0.5) * (0.2 + effectIntensity * 0.3);
                            targetRotY += (Math.random() - 0.5) * (0.2 + effectIntensity * 0.3);
                        } else if (effectMode === 3) {
                            const burstPhase = Math.sin(randomPhase) * 0.5 + 0.5;
                            if (burstPhase > 0.7) {
                                for(let i = 0; i < size; i += Math.floor(size / (50 + Math.random() * 40))) {
                                    if (gridChars[i] && Math.random() > 0.4) {
                                        const distFromCenter = Math.sqrt(
                                            Math.pow((i % cols) - cols/2, 2) + 
                                            Math.pow(Math.floor(i / cols) - rows/2, 2)
                                        );
                                        const radialGlitch = Math.sin(distFromCenter * 0.1 + randomPhase) * (20 + effectIntensity * 30);
                                        glitchOffset[i] = Math.floor(radialGlitch);
                                    }
                                }
                            }
                        } else if (effectMode === 4) {
                            const twist = Math.sin(randomPhase) * 0.8;
                            targetRotX = twist * (1 + effectIntensity);
                            targetRotY = Math.cos(randomPhase * 1.5) * 0.6 * (1 + effectIntensity);
                            zoomLevel = 1.0 + Math.sin(randomPhase * 0.7) * 0.3;
                            targetZoom = zoomLevel;
                        } else {
                            targetRotX += (Math.random() - 0.5) * (0.15 + effectIntensity * 0.25);
                            targetRotY += (Math.random() - 0.5) * (0.15 + effectIntensity * 0.25);
                            zoomLevel += (Math.random() - 0.5) * 0.08;
                            targetZoom = Math.max(0.4, Math.min(2.5, zoomLevel));
                            if (Math.random() > 0.7) {
                                const idx = Math.floor(Math.random() * size);
                                if (gridChars[idx]) {
                                    glitchOffset[idx] = Math.floor((Math.random() - 0.5) * (30 + effectIntensity * 40));
                                }
                            }
                        }
                        
                        if (detectedFingers > 0) {
                            const fingerMod = detectedFingers * 0.1;
                            targetRotX += Math.sin(globalTime * (1 + fingerMod)) * (0.2 + fingerMod);
                            targetRotY += Math.cos(globalTime * (1.3 + fingerMod)) * (0.2 + fingerMod);
                        }
                        
                        zoomLevel = p.lerp(zoomLevel, targetZoom, 0.15 + chaos * 0.1);

                        if (leftHandActive || rightHandActive) {
                            if (Math.random() > 0.98) {
                                const pdColor = getColor(globalTime, kickVol, chaos);
                                floatingPetals.push({
                                    x: p.width * 0.5 + (Math.random() - 0.5) * 200,
                                    y: p.height * 0.5 + (Math.random() - 0.5) * 200,
                                    size: 20 + Math.random() * 30,
                                    angle: Math.random() * Math.PI * 2,
                                    vx: (Math.random() - 0.5) * 2,
                                    vy: (Math.random() - 0.5) * 2,
                                    va: (Math.random() - 0.5) * 0.1,
                                    life: 150 + Math.random() * 50,
                                    color: pdColor
                                });
                            }
                        }

                        floatingPetals = floatingPetals.filter(petal => {
                            petal.x += petal.vx;
                            petal.y += petal.vy;
                            petal.angle += petal.va;
                            petal.vx *= 0.98;
                            petal.vy *= 0.98;
                            petal.life--;
                            return petal.life > 0 && petal.x > -100 && petal.x < p.width + 100 && petal.y > -100 && petal.y < p.height + 100;
                        });
                        
                        const lerpSpeed = 0.12 + chaos * 0.08;
                        rotX = p.lerp(rotX, targetRotX, lerpSpeed);
                        rotY = p.lerp(rotY, targetRotY, lerpSpeed);
                        
                        if (Math.random() > 0.85) {
                            rotX += (Math.random() - 0.5) * 0.05 * chaos;
                            rotY += (Math.random() - 0.5) * 0.05 * chaos;
                        }

                        const cx = Math.cos(rotX + (bass * 0.5));
                        const sx = Math.sin(rotX + (bass * 0.5));
                        const cy = Math.cos(rotY + (mid * 0.5));
                        const sy = Math.sin(rotY + (mid * 0.5));

                        zBuffer.fill(-10000);
                        
                        const glitchChance = (kickVol > 0.6 && Math.random() > 0.4) || 
                                           (mid > 0.7 && Math.random() > 0.5) ||
                                           (chaos > 0.7 && Math.random() > 0.6);
                        if (glitchChance) updateGlitchMap(false);
                        
                        viewportDriftX += (Math.random() - 0.5) * (bass * 20);
                        viewportDriftY += (Math.random() - 0.5) * (bass * 20);
                        
                        let hasFeed = false;
                        
                        if (capture && capture.width > 0) {
                            const pixels = (capture as any).pixels;
                            const capW = capture.width;
                            const capH = capture.height;
                            
                            const rgbSplit = (kickVol * 40) + (audioEngine.modX * 30) + (chaos * 50);
                            const lensStrength = (kickVol * 0.8) + (chaos * 0.5); 
                            const centerX = capW / 2;
                            const centerY = capH / 2;

                            if (pixels && pixels.length > 0) {
                                hasFeed = true;
                                
                                for (let i = 0; i < cols * rows; i += 4) {
                                    const c = i % cols;
                                    const r = Math.floor(i / cols);
                                    
                                    let vX = (1 - (c / cols)) * capW;
                                    let vY = (r / rows) * capH;

                                    vX = (vX - centerX) / zoomLevel + centerX;
                                    vY = (vY - centerY) / zoomLevel + centerY;

                                    let nx = (vX - centerX) / centerX;
                                    let ny = (vY - centerY) / centerY;
                                    let radius = nx*nx + ny*ny; 
                                    
                                    let distFactor = 1.0 + (lensStrength * radius * 0.5);
                                    
                                    vX = centerX + (nx * distFactor * centerX);
                                    vY = centerY + (ny * distFactor * centerY);

                                    if (c >= blockGlitch.x && c < blockGlitch.x + blockGlitch.w &&
                                        r >= blockGlitch.y && r < blockGlitch.y + blockGlitch.h) {
                                        vX += blockGlitch.offX;
                                        vY += blockGlitch.offY;
                                    }

                                    const waveX = Math.sin((r / rows) * 10 + globalTime * 35) * (kickVol * 40 + chaos * 20);
                                    vX += waveX + viewportDriftX;
                                    vY += viewportDriftY;
                                    vX += (glitchRows[r] || 0);

                                    let ivX = Math.floor(vX);
                                    let ivY = Math.floor(vY);

                                    ivX = Math.max(0, Math.min(capW - 1, ivX));
                                    ivY = Math.max(0, Math.min(capH - 1, ivY));

                                    const idxBase = (ivX + ivY * capW) * 4;
                                    const splitOffset = Math.floor(rgbSplit) * 4;
                                    
                                    const idxR = Math.min(pixels.length - 4, Math.max(0, idxBase + splitOffset));
                                    const idxB = Math.min(pixels.length - 4, Math.max(0, idxBase - splitOffset));
                                    
                                    const pr = pixels[idxR];
                                    const pg = pixels[idxBase + 1]; 
                                    const pb = pixels[idxB + 2];
                                    
                                    const bright = (pr + pg + pb) / 3;
                                    const forceGlitch = (chaos > 0.7 && Math.random() > (0.95 - chaos * 0.1));
                                    const isDark = bright < 20;

                                    if (isDark || forceGlitch) {
                                        const tQ = Math.floor(globalTime * 12); 
                                        const rowQ = r + tQ;
                                        const densityThreshold = 0.95 - (chaos * 0.8); 
                                        const isScanLine = Math.sin(rowQ * 0.5) > densityThreshold;
                                        const isVertLine = (c % (Math.floor(12 - chaos * 8) || 1) === 0);
                                        const isActive = isScanLine || (isVertLine && Math.random() > 0.6);

                                        if (isActive) {
                                            gridChars[i] = EMPTY_CHAR;
                                            if (i + 1 < cols * rows) gridChars[i + 1] = EMPTY_CHAR;

                                            if (chaos > 0.8 && Math.random() > 0.9) {
                                                 gridColors[i*3] = 255;
                                                 gridColors[i*3+1] = 0;
                                                 gridColors[i*3+2] = 0;
                                                 if (i + 1 < cols * rows) {
                                                     gridColors[(i+1)*3] = 255;
                                                     gridColors[(i+1)*3+1] = 0;
                                                     gridColors[(i+1)*3+2] = 0;
                                                 }
                                            } else {
                                                 const val = 180;
                                                 gridColors[i*3] = val;
                                                 gridColors[i*3+1] = val;
                                                 gridColors[i*3+2] = val;
                                                 if (i + 1 < cols * rows) {
                                                     gridColors[(i+1)*3] = val;
                                                     gridColors[(i+1)*3+1] = val;
                                                     gridColors[(i+1)*3+2] = val;
                                                 }
                                            }
                                        } else {
                                            gridChars[i] = "";
                                            if (i + 1 < cols * rows) gridChars[i + 1] = "";
                                        }
                                        
                                        gridMeta[i] = 0;
                                        gridGlow[i] = 0;
                                        if (i + 1 < cols * rows) {
                                            gridMeta[i + 1] = 0;
                                            gridGlow[i + 1] = 0;
                                        }

                                    } else {
                                        const desat = 0.1;
                                        const avg = (pr + pg + pb) / 3;
                                        
                                        let baseR = p.lerp(pr, avg, desat) * 2.0;
                                        let baseG = p.lerp(pg, avg, desat) * 2.0;
                                        let baseB = p.lerp(pb, avg, desat) * 2.0;
                                        
                                        const centerDistX = Math.abs(c - cols / 2) / (cols / 2);
                                        const centerDistY = Math.abs(r - rows / 2) / (rows / 2);
                                        const centerDist = Math.sqrt(centerDistX * centerDistX + centerDistY * centerDistY);
                                        
                                        const audioReactive = kickVol * 0.5 + bass * 0.3 + mid * 0.2;
                                        const flowerShape = Math.sin(centerDist * Math.PI * 4 + globalTime * 2) * 0.5 + 0.5;
                                        const petalPattern = Math.sin(Math.atan2(r - rows/2, c - cols/2) * 6 + globalTime * 1.5) * 0.3 + 0.7;
                                        
                                        const flowerIntensity = (1 - centerDist) * flowerShape * petalPattern * (0.5 + audioReactive);
                                        
                                        if (flowerIntensity > 0.3 || bright > 50) {
                                            gridChars[i] = EMPTY_CHAR;
                                            if (i + 1 < cols * rows) gridChars[i + 1] = EMPTY_CHAR;
                                            
                                            const pdColor = getColor(globalTime, kickVol, chaos);
                                            const flowerR = p.lerp(baseR, pdColor.r, flowerIntensity * 0.6);
                                            const flowerG = p.lerp(baseG, pdColor.g, flowerIntensity * 0.6);
                                            const flowerB = p.lerp(baseB, pdColor.b, flowerIntensity * 0.6);
                                            
                                            const audioBoost = 1.0 + audioReactive * 0.4;
                                            
                                            gridColors[i*3] = Math.min(255, flowerR * audioBoost);
                                            gridColors[i*3+1] = Math.min(255, flowerG * audioBoost);
                                            gridColors[i*3+2] = Math.min(255, flowerB * audioBoost);
                                            
                                            if (i + 1 < cols * rows) {
                                                gridColors[(i+1)*3] = Math.min(255, flowerR * audioBoost);
                                                gridColors[(i+1)*3+1] = Math.min(255, flowerG * audioBoost);
                                                gridColors[(i+1)*3+2] = Math.min(255, flowerB * audioBoost);
                                            }
                                            
                                            gridMeta[i] = flowerIntensity > 0.6 ? 1 : 0;
                                            gridGlow[i] = flowerIntensity * audioReactive;
                                            if (i + 1 < cols * rows) {
                                                gridMeta[i + 1] = flowerIntensity > 0.6 ? 1 : 0;
                                                gridGlow[i + 1] = flowerIntensity * audioReactive;
                                            }
                                        } else {
                                            gridChars[i] = "";
                                            if (i + 1 < cols * rows) gridChars[i + 1] = "";
                                        gridMeta[i] = 0;
                                        gridGlow[i] = 0;
                                            if (i + 1 < cols * rows) {
                                                gridMeta[i + 1] = 0;
                                                gridGlow[i + 1] = 0;
                                            }
                                        }
                                    }
                                }
                            }
                        } 
                        
                        if (!hasFeed) {
                            for (let i = 0; i < size; i++) {
                                const c = i % cols;
                                const r = Math.floor(i / cols);
                                const centerDistX = Math.abs(c - cols / 2) / (cols / 2);
                                const centerDistY = Math.abs(r - rows / 2) / (rows / 2);
                                const centerDist = Math.sqrt(centerDistX * centerDistX + centerDistY * centerDistY);
                                
                                const audioReactive = kickVol * 0.5 + bass * 0.3 + mid * 0.2;
                                const flowerShape = Math.sin(centerDist * Math.PI * 4 + globalTime * 2) * 0.5 + 0.5;
                                const petalPattern = Math.sin(Math.atan2(r - rows/2, c - cols/2) * 6 + globalTime * 1.5) * 0.3 + 0.7;
                                const flowerIntensity = (1 - centerDist) * flowerShape * petalPattern * (0.5 + audioReactive);
                                
                                if (flowerIntensity > 0.2) {
                                    gridChars[i] = EMPTY_CHAR;
                                    const pdColor = getColor(globalTime, kickVol, chaos);
                                    gridColors[i*3] = pdColor.r * flowerIntensity;
                                    gridColors[i*3+1] = pdColor.g * flowerIntensity;
                                    gridColors[i*3+2] = pdColor.b * flowerIntensity;
                                    gridMeta[i] = flowerIntensity > 0.5 ? 1 : 0;
                                    gridGlow[i] = flowerIntensity * audioReactive;
                                } else {
                                    gridChars[i] = "";
                                    gridMeta[i] = 0;
                                    gridGlow[i] = 0;
                                }
                            }
                        }
                        
                        if (cachedRippleIntensity < 0 && ripples.length > 0) {
                            cachedRippleIntensity = Math.min(1, ripples.length * 0.15 + ripples.reduce((sum, r) => sum + (r.strength * (1 - r.life / r.maxLife)), 0) * 0.3);
                        } else if (ripples.length === 0) {
                            cachedRippleIntensity = 0;
                        }
                        const rippleGlitchIntensity = cachedRippleIntensity;
                        const wildFactor = 0.6 + (chaos * 0.4) + (kickVol * 0.3);
                        
                        if ((chaos > 0.6 || kickVol > 0.7 || rippleGlitchIntensity > 0.4) && Math.random() > 0.7) {
                            const baseGlitch = Math.floor((chaos + kickVol) * 5 * wildFactor);
                            const rippleGlitch = Math.floor(rippleGlitchIntensity * 8 * wildFactor);
                            const glitchAmount = Math.min(30, baseGlitch + rippleGlitch);
                            
                            for(let g = 0; g < glitchAmount; g++) {
                                const idx = Math.floor(Math.random() * size);
                                if (gridChars[idx]) {
                                    const wildOffset = (Math.random() - 0.5) * 40 * wildFactor;
                                    glitchOffset[idx] = Math.floor(wildOffset);
                                }
                            }
                        }
                        
                        if ((leftHandActive || rightHandActive) && Math.random() > 0.85) {
                            const handGlitch = Math.min(15, Math.floor((Math.abs(leftHandY - rightHandY) + chaos) * 4 * wildFactor));
                            for(let g = 0; g < handGlitch; g++) {
                                const idx = Math.floor(Math.random() * size);
                                if (gridChars[idx]) {
                                    glitchOffset[idx] = Math.floor((Math.random() - 0.5) * 30 * wildFactor);
                                }
                            }
                        }
                        
                        if (ripples.length > 0 && Math.random() > 0.9) {
                            const ripple = ripples[0];
                            if (ripple.radius > 20) {
                                const rippleGlitchX = ripple.x + (Math.random() - 0.5) * ripple.radius;
                                const rippleGlitchY = ripple.y + (Math.random() - 0.5) * ripple.radius;
                                const glitchCol = Math.floor(rippleGlitchX / fontSize);
                                const glitchRow = Math.floor(rippleGlitchY / (fontSize * 0.65));
                                
                                if (glitchCol >= 0 && glitchCol < cols && glitchRow >= 0 && glitchRow < rows) {
                                    const glitchIdx = glitchCol + glitchRow * cols;
                                    if (glitchIdx >= 0 && glitchIdx < size && gridChars[glitchIdx]) {
                                        const waveGlitch = Math.sin(ripple.phase + globalTime * 4) * ripple.strength * 30 * wildFactor;
                                        glitchOffset[glitchIdx] = Math.floor(waveGlitch);
                                    }
                                }
                            }
                        }
                        
                        if ((kickVol > 0.75 || chaos > 0.85) && Math.random() > 0.6) {
                            const wildChopAmount = Math.min(20, Math.floor((kickVol + chaos) * 8 * wildFactor));
                            for(let c = 0; c < wildChopAmount; c++) {
                                const idx = Math.floor(Math.random() * size);
                                if (gridChars[idx]) {
                                    if (Math.random() > 0.5) {
                                        glitchOffset[idx] = Math.floor((Math.random() - 0.5) * 50 * wildFactor);
                                    } else {
                                        gridChars[idx] = "";
                                    }
                                }
                            }
                        }
                        
                        for(let i = 0; i < size; i += 2) {
                            if (glitchOffset[i] !== 0) {
                                glitchOffset[i] *= 0.85;
                                if (Math.abs(glitchOffset[i]) < 0.5) glitchOffset[i] = 0;
                            }
                        }

                        const beatsPerSecond = audioEngine.tempo / 60;
                        const timeScale = 1.0 + (high * 2);
                        const beatPhase = globalTime * beatsPerSecond * timeScale; 
                        
                        const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 4);
                        const breath = 1.0 + (pulse * 0.2) + (kickVol * 0.4); 
                        const radiusMod = 160 + (leftHandY * 50); 
                        
                        const pdColor = getColor(globalTime, kickVol, chaos);
                        const layerCount = Math.max(3, Math.min(4, 3 + Math.floor(mid * 2))); 
                        
                        const layers = [
                            { type: 'pod', rings: 4, dens: 25, rad: 0.12, height: 0.3 },
                            { type: 'petal', rings: 8, dens: 60, rad: 0.5, height: 0.6, k: 5 + (bass*5), angle: Math.PI/3.5, width: 1.5, offset: globalTime },
                            { type: 'petal', rings: 10, dens: 70, rad: 0.9, height: 0.35, k: 7, angle: Math.PI/2.4, width: 1.8, offset: Math.PI/7 },
                            { type: 'petal', rings: 12, dens: 80, rad: 1.3, height: 0.1, k: 9 + (mid*10), angle: Math.PI/1.9, width: 2.0, offset: Math.PI/9 },
                        ];

                        const activeLayers = layers.slice(0, layerCount);

                        activeLayers.forEach(l => {
                            renderLayer(l, radiusMod * breath, globalTime, cx, sx, cy, sy, pdColor, kickVol, chaos);
                        });
                        
                    }

                    const ctx = p.drawingContext as CanvasRenderingContext2D;
                    ctx.shadowBlur = 0;

                    for (const petal of floatingPetals) {
                        const alpha = (petal.life / 300) * 180;
                        p.push();
                        p.translate(petal.x, petal.y);
                        p.rotate(petal.angle);
                        p.fill(petal.color.r, petal.color.g, petal.color.b, alpha);
                        p.textSize(petal.size);
                        p.text(EMPTY_CHAR, 0, 0);
                        p.pop();
                    }
                    
                    for (const f of floatingAscii) {
                        const alpha = (f.life / 80) * 180;
                        const palette = videoColors.length > 0 ? videoColors : baseColors;
                        const colorIdx = Math.floor((globalTime * 1 + f.life * 0.1) % palette.length);
                        const color = palette[colorIdx];
                        p.fill(color.r, color.g, color.b, alpha);
                        p.text(f.char, f.x, f.y);
                    }
                    
                    for (const particle of physicsParticles) {
                        const alpha = (particle.life / 100) * 120;
                        const palette = videoColors.length > 0 ? videoColors : baseColors;
                        const colorIdx = Math.floor((globalTime * 0.8 + particle.life * 0.05) % palette.length);
                        const color = palette[colorIdx];
                        const size = 3 + (particle.mass / 50) * 2;
                        p.fill(color.r, color.g, color.b, alpha);
                        p.noStroke();
                        p.circle(particle.x, particle.y, size);
                        p.fill(color.r * 1.5, color.g * 1.5, color.b * 1.5, alpha * 0.3);
                        p.circle(particle.x, particle.y, size * 2);
                    }
                    
                    const dt = 1.0 / 60.0;
                    const springConstant = 0.12;
                    const damping = 0.90;
                    const viscosity = 0.94;
                    const gravity = 0.3;
                    const audioForce = (kickVol * 0.8 + bass * 0.5 + chaos * 0.6);
                    
                    if (!charVelX || !charVelY || !charAccelX || !charAccelY || !charBaseX || !charBaseY || size === 0) {
                        for (let i = 0; i < size; i++) {
                            const char = gridChars[i];
                            if (!char || char === "") continue;
                            let x = (i % cols) * fontSize;
                            let y = Math.floor(i / cols) * (fontSize * 0.65);
                            x += glitchOffset[i] || 0;

                        let r = gridColors[i*3];
                        let g = gridColors[i*3+1];
                        let b = gridColors[i*3+2];

                        const isLotus = gridMeta[i] === 1;
                        if (!isLotus) {
                            r *= (0.8 + mid);
                            g *= (0.8 + mid);
                            b *= (0.8 + mid);
                        }

                        if (colorShift !== 0) {
                            const shift = colorShift * 50;
                            r = Math.max(0, Math.min(255, r + shift));
                            g = Math.max(0, Math.min(255, g - shift * 0.5));
                            b = Math.max(0, Math.min(255, b + shift * 0.3));
                        }
                        
                        if (chaos > 0.9 && Math.random() > 0.95) {
                            r = 255 - r * 0.3;
                            g = 255 - g * 0.3;
                            b = 255 - b * 0.3;
                        }

                            const ctx = p.drawingContext as CanvasRenderingContext2D;
                        if (isLotus) {
                            const glow = gridGlow[i];
                                ctx.shadowBlur = Math.max(0, glow * 15 + 5);
                                ctx.shadowColor = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},0.6)`;
                                p.fill(Math.floor(r), Math.floor(g), Math.floor(b), 255);
                        } else {
                                const baseAlpha = Math.min(255, (chaos > 0.5) ? 200 : 240);
                            ctx.shadowBlur = 0;
                                p.fill(Math.floor(r), Math.floor(g), Math.floor(b), Math.floor(baseAlpha));
                            }
                            p.text(char, x, y);
                        }
                        return;
                    }
                        
                    for (let i = 0; i < size; i++) {
                        if (!gridChars[i] || gridChars[i] === "") {
                            charVelX[i] *= 0.9;
                            charVelY[i] *= 0.9;
                            charAccelX[i] = 0;
                            charAccelY[i] = 0;
                            continue;
                        }
                        
                        const baseX = charBaseX[i];
                        const baseY = charBaseY[i];
                        const currentX = baseX + glitchOffset[i];
                        const currentY = baseY;
                        
                        charAccelX[i] = 0;
                        charAccelY[i] = 0;
                        
                        const springForceX = (baseX - currentX) * springConstant;
                        const springForceY = (baseY - currentY) * springConstant;
                        charAccelX[i] += springForceX;
                        charAccelY[i] += springForceY;
                        
                        charAccelY[i] += gravity * (1 + audioForce * 0.5);
                        
                        if (ripples.length > 0) {
                            let nearestRipple = null;
                            let nearestDistSq = Infinity;
                        
                        for (const ripple of ripples) {
                            const dx = currentX - ripple.x;
                            const dy = currentY - ripple.y;
                                const distSq = dx * dx + dy * dy;
                                const maxDistSq = (ripple.radius * 3) * (ripple.radius * 3);
                                
                                if (distSq < maxDistSq && distSq < nearestDistSq) {
                                    nearestDistSq = distSq;
                                    nearestRipple = ripple;
                                }
                            }
                            
                            if (nearestRipple) {
                                const dist = Math.sqrt(nearestDistSq);
                                const maxDist = nearestRipple.radius * 3;
                                if (dist < maxDist && dist > 0.1) {
                                    const dx = currentX - nearestRipple.x;
                                    const dy = currentY - nearestRipple.y;
                                    const angle = Math.atan2(dy, dx);
                                    const waveDist = dist - nearestRipple.radius;
                                    const progress = nearestRipple.life / nearestRipple.maxLife;
                                    const fade = Math.max(0, 1 - progress * 1.5);
                                    const centerFade = dist < nearestRipple.radius ? (dist / nearestRipple.radius) : 1;
                                    
                                    const waveForce = Math.sin(waveDist * nearestRipple.frequency * 2 - nearestRipple.phase) * nearestRipple.strength * fade * centerFade;
                                    const radialForce = Math.sin(dist * 0.25 + globalTime * 4) * nearestRipple.amplitude * 0.25 * centerFade;
                                    const totalForce = (waveForce + radialForce) * fade * (1 + audioForce);
                                    
                                    const forceX = Math.cos(angle) * totalForce * 1.0;
                                    const forceY = Math.sin(angle) * totalForce * 1.0;
                                
                                    charAccelX[i] += forceX;
                                    charAccelY[i] += forceY;
                                }
                            }
                        }
                        
                        for (const particle of physicsParticles) {
                            const dx = currentX - particle.x;
                            const dy = currentY - particle.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist < 100 && dist > 0.1) {
                                const attraction = particle.mass / (dist * dist + 1) * 0.5;
                                charAccelX[i] += (dx / dist) * attraction;
                                charAccelY[i] += (dy / dist) * attraction;
                            }
                        }
                        
                        charVelX[i] += charAccelX[i] * dt;
                        charVelY[i] += charAccelY[i] * dt;
                        
                        charVelX[i] *= damping;
                        charVelY[i] *= damping;
                        charVelX[i] *= viscosity;
                        charVelY[i] *= viscosity;
                        
                        const maxVel = 15 + audioForce * 10;
                        charVelX[i] = Math.max(-maxVel, Math.min(maxVel, charVelX[i]));
                        charVelY[i] = Math.max(-maxVel, Math.min(maxVel, charVelY[i]));
                    }
                    
                    if (kickVol > 0.6 || chaos > 0.7) {
                        for (let part = 0; part < Math.floor((kickVol + chaos) * 3); part++) {
                            physicsParticles.push({
                                x: Math.random() * p.width,
                                y: Math.random() * p.height,
                                vx: (Math.random() - 0.5) * 8,
                                vy: (Math.random() - 0.5) * 8,
                                ax: 0,
                                ay: 0,
                                mass: 50 + Math.random() * 100,
                                life: 60 + Math.random() * 40
                            });
                        }
                    }
                    
                    physicsParticles = physicsParticles.filter(particle => {
                        particle.ax = (Math.random() - 0.5) * 0.8 * (1 + audioForce);
                        particle.ay = (Math.random() - 0.5) * 0.8 * (1 + audioForce) + gravity * 0.5;
                        
                        if (ripples.length > 0) {
                            let nearestRipple = null;
                            let nearestDistSq = Infinity;
                        
                        for (const ripple of ripples) {
                            const dx = particle.x - ripple.x;
                            const dy = particle.y - ripple.y;
                                const distSq = dx * dx + dy * dy;
                                const maxDistSq = (ripple.radius * 2) * (ripple.radius * 2);
                                
                                if (distSq < maxDistSq && distSq < nearestDistSq) {
                                    nearestDistSq = distSq;
                                    nearestRipple = ripple;
                                }
                            }
                            
                            if (nearestRipple) {
                                const dist = Math.sqrt(nearestDistSq);
                                if (dist < nearestRipple.radius * 2 && dist > 0.1) {
                                    const dx = particle.x - nearestRipple.x;
                                    const dy = particle.y - nearestRipple.y;
                                const angle = Math.atan2(dy, dx);
                                    const force = nearestRipple.strength * (1 - dist / (nearestRipple.radius * 2)) * 2;
                                particle.ax += Math.cos(angle) * force;
                                particle.ay += Math.sin(angle) * force;
                                }
                            }
                        }
                        
                        particle.vx += particle.ax * dt;
                        particle.vy += particle.ay * dt;
                        particle.vx *= 0.92;
                        particle.vy *= 0.92;
                        
                        particle.x += particle.vx;
                        particle.y += particle.vy;
                        
                        if (particle.x < 0) { particle.x = 0; particle.vx *= -0.7; }
                        if (particle.x > p.width) { particle.x = p.width; particle.vx *= -0.7; }
                        if (particle.y < 0) { particle.y = 0; particle.vy *= -0.7; }
                        if (particle.y > p.height) { particle.y = p.height; particle.vy *= -0.7; }
                        
                        particle.life--;
                        return particle.life > 0;
                    });
                    
                    if (ripples.length === 0 || maxRippleRadiusSq === 0) {
                        for (let i = 0; i < size; i++) {
                            const char = gridChars[i];
                            if (!char || char === "") continue;
                            let x = charBaseX[i] + charVelX[i] + glitchOffset[i];
                            let y = charBaseY[i] + charVelY[i];
                            
                            let r = gridColors[i*3];
                            let g = gridColors[i*3+1];
                            let b = gridColors[i*3+2];
                            
                            const glow = gridGlow[i];
                            if (glow > 0) {
                                r = Math.min(255, r + glow * 30);
                                g = Math.min(255, g + glow * 20);
                                b = Math.min(255, b + glow * 40);
                            }
                            
                            p.fill(r, g, b);
                            p.text(char, x, y);
                        }
                    } else {
                        for (let i = 0; i < size; i++) {
                            const char = gridChars[i];
                            if (!char || char === "") continue;

                            let x = charBaseX[i] + charVelX[i] + glitchOffset[i];
                            let y = charBaseY[i] + charVelY[i];
                            
                            let inRippleZone = false;
                            for (const [rippleIdx, zone] of rippleZones.entries()) {
                                if (zone.has(i)) {
                                    inRippleZone = true;
                                    break;
                                }
                            }
                            
                            if (!inRippleZone) {
                                let r = gridColors[i*3];
                                let g = gridColors[i*3+1];
                                let b = gridColors[i*3+2];
                                
                                const glow = gridGlow[i];
                                if (glow > 0) {
                                    r = Math.min(255, r + glow * 30);
                                    g = Math.min(255, g + glow * 20);
                                    b = Math.min(255, b + glow * 40);
                                }
                                
                                p.fill(r, g, b);
                                p.text(char, x, y);
                                continue;
                            }
                            
                            let nearestRipple = null;
                            let nearestDistSq = Infinity;
                            
                            for (let rippleIdx = 0; rippleIdx < ripples.length; rippleIdx++) {
                                const ripple = ripples[rippleIdx];
                                const dx = x - ripple.x;
                                const dy = y - ripple.y;
                                const distSq = dx * dx + dy * dy;
                                const maxDistSq = (ripple.radius * 3) * (ripple.radius * 3);
                                
                                if (distSq < maxDistSq && distSq < nearestDistSq) {
                                    nearestDistSq = distSq;
                                    nearestRipple = ripple;
                                }
                            }
                            
                            let rippleOffsetX = 0;
                            let rippleOffsetY = 0;
                            let chromaticR = 0;
                            let chromaticB = 0;
                            let blurAmount = 0;
                            
                            if (nearestRipple) {
                                const dist = Math.sqrt(nearestDistSq);
                                const maxDist = nearestRipple.radius * 3.5;
                                const edgeFadeStart = maxDist * 0.7;
                                
                                if (dist < maxDist && dist > 0.1) {
                                    const dx = x - nearestRipple.x;
                                    const dy = y - nearestRipple.y;
                                    const angle = Math.atan2(dy, dx);
                                    const waveDist = dist - nearestRipple.radius;
                                    
                                    const progress = nearestRipple.life / nearestRipple.maxLife;
                                    const fade = Math.max(0, 1 - progress * 1.5);
                                    const centerFade = dist < nearestRipple.radius ? (dist / nearestRipple.radius) : 1;
                                    const edgeFade = dist > edgeFadeStart ? Math.max(0, 1 - (dist - edgeFadeStart) / (maxDist - edgeFadeStart)) : 1;
                                    const combinedFade = fade * centerFade * edgeFade;
                                    
                                    const wildSpeed = 1.0 + (chaos * 0.8) + (kickVol * 0.6);
                                    const primaryWave = Math.sin(waveDist * nearestRipple.frequency * 2 - nearestRipple.phase * wildSpeed) * nearestRipple.strength * combinedFade;
                                    const secondaryWave = Math.sin(waveDist * nearestRipple.frequency * 4 - nearestRipple.phase * 2.5 * wildSpeed) * nearestRipple.strength * 0.5 * combinedFade;
                                    const radialWave = Math.sin(dist * 0.3 + globalTime * 5 * wildSpeed + nearestRipple.phase) * nearestRipple.amplitude * 0.15 * combinedFade;
                                    
                                    const totalWave = (primaryWave + secondaryWave + radialWave) * fade;
                                    
                                    rippleOffsetX = Math.cos(angle) * totalWave * 30 * wildSpeed;
                                    rippleOffsetY = Math.sin(angle) * totalWave * 30 * wildSpeed;
                                    
                                    const chromaticIntensity = Math.abs(totalWave) * 0.25;
                                    const rippleColorShift = Math.sin(dist * 0.15 + nearestRipple.phase) * chromaticIntensity;
                                    chromaticR = rippleColorShift * 12;
                                    chromaticB = -rippleColorShift * 12;
                                    
                                    blurAmount = Math.abs(totalWave) * fade * 0.6;
                                }
                            }
                        
                        x += rippleOffsetX * 0.4;
                        y += rippleOffsetY * 0.4;

                        let r = gridColors[i*3];
                        let g = gridColors[i*3+1];
                        let b = gridColors[i*3+2];
                        
                        if (blurAmount > 0.1) {
                            r = Math.min(255, Math.max(0, r + chromaticR));
                            g = Math.min(255, Math.max(0, g));
                            b = Math.min(255, Math.max(0, b + chromaticB));
                        }

                        const isLotus = gridMeta[i] === 1;

                        if (!isLotus) {
                            r *= (0.8 + mid);
                            g *= (0.8 + mid);
                            b *= (0.8 + mid);
                        }

                        if (colorShift !== 0) {
                            const shift = colorShift * 50;
                            r = Math.max(0, Math.min(255, r + shift));
                            g = Math.max(0, Math.min(255, g - shift * 0.5));
                            b = Math.max(0, Math.min(255, b + shift * 0.3));
                        }
                        
                        if (chaos > 0.9 && Math.random() > 0.95) {
                            r = 255 - r * 0.3;
                            g = 255 - g * 0.3;
                            b = 255 - b * 0.3;
                        }

                        let rippleProximity = Infinity;
                        if (nearestRipple) {
                            const dx = x - nearestRipple.x;
                            const dy = y - nearestRipple.y;
                            rippleProximity = Math.sqrt(dx * dx + dy * dy);
                        }
                        
                        const rippleInfluence = rippleProximity < 200 ? (1 - rippleProximity / 200) : 0;
                        const dreamyBlur = rippleInfluence * 0.3;
                        const dreamyGlow = rippleInfluence * 0.5;

                        let shadowBlur = 0;
                        let shadowColor = '';

                        if (isLotus) {
                            const glow = gridGlow[i] + dreamyGlow;
                            shadowBlur = Math.max(0, glow * 12 + 4 + dreamyBlur * 6); 
                            shadowColor = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${0.5 + dreamyGlow * 0.1})`;
                        } else {
                            shadowBlur = Math.max(0, dreamyBlur * 4);
                            shadowColor = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${dreamyGlow * 0.1})`;
                        }
                        
                        if (ctx.shadowBlur !== shadowBlur) {
                            ctx.shadowBlur = shadowBlur;
                        }
                        if (ctx.shadowColor !== shadowColor) {
                            ctx.shadowColor = shadowColor;
                        }
                        
                        const alpha = isLotus ? 255 : Math.min(255, (chaos > 0.5) ? 200 : 240);
                        p.fill(Math.floor(r), Math.floor(g), Math.floor(b), Math.floor(alpha));
                        p.text(char, x, y);
                        }
                    }
                } catch(e) { }
            };

            function getPetalRadius(theta: number, k: number, widthMod: number) {
                return Math.pow(Math.abs(Math.cos(k * theta / 2)), 1.0 / widthMod);
            }

            function renderLayer(cfg: any, baseRad: number, time: number, cx: number, sx: number, cy: number, sy: number, pdColor: any, audio: number, chaos: number) {
                const twist = Math.sin(time * 0.2) * 0.5 * (chaos + 0.2 + audio); 
                const morphWidth = (cfg.width || 1.0) + Math.sin(time * 0.6) * 0.5 + chaos * 0.5;
                const morphK = cfg.k + Math.sin(time * 0.1 + cfg.rad) * (chaos * 5) + audio * 10;

                for (let r = 0; r < cfg.rings; r++) {
                    const progress = r / cfg.rings; 
                    let phi = progress * 0.5 * Math.PI + 0.1;
                    
                    if (cfg.type === 'petal') {
                        phi = Math.PI / 2 - cfg.angle * (1 - Math.pow(progress, 2));
                        phi += Math.sin(time * 2 + r * 0.5) * 0.1 * (chaos + audio);
                    } 

                    for (let d = 0; d < cfg.dens; d++) {
                        const theta = (d / cfg.dens) * Math.PI * 2;
                        const twistedTheta = theta + (r * 0.05 * twist);

                        let rMult = 1.0;
                        if (cfg.type === 'pod') {
                            rMult = 1.0 + Math.sin(twistedTheta * 10) * 0.05;
                        } else {
                            const jitter = (Math.random() - 0.5) * audio * 0.1;
                            rMult = getPetalRadius(twistedTheta + (cfg.offset || 0) + jitter, morphK, morphWidth);
                            if (rMult < 0.2) continue;
                        }

                        rMult += Math.sin(twistedTheta * 3 + time * 0.2) * 0.02;
                        let rad = baseRad * cfg.rad * rMult;
                        if (audio > 0.2) rad += audio * 40 * Math.sin(twistedTheta * 20);

                        let x0 = rad * Math.cos(theta) * Math.sin(phi);
                        let y0 = rad * Math.sin(theta) * Math.sin(phi);
                        const wave = Math.sin(r * 0.3 + time * 1.5) * (baseRad * 0.3 * (chaos + audio));
                        let z0 = rad * Math.cos(phi) + wave;
                        
                        if (cfg.type === 'petal') z0 *= 0.8; 

                        const spin = time * 0.1 + (audio * 0.1);
                        let x = x0 * Math.cos(spin) - y0 * Math.sin(spin);
                        let y = x0 * Math.sin(spin) + y0 * Math.cos(spin);
                        let z = z0;

                        if (chaos > 0.5 && audio > 0.5) {
                             const disp = (Math.random() - 0.5) * chaos * 50;
                             x += disp; 
                             y += disp;
                             z += disp;
                        }

                        let x2 = x * cy - z * sy;
                        let z2 = x * sy + z * cy;
                        let y2 = y * cx - z2 * sx;
                        let z3 = y * sx + z2 * cx;

                        const fov = 400; 
                        const viewerZ = 350 - audio * 100;
                        const scale = fov / (z3 + viewerZ);

                        if (z3 + viewerZ < 10) continue;

                        const col = Math.floor(cols / 2 + x2 * scale);
                        const row = Math.floor(rows / 2 + y2 * scale);

                        if (col >= 0 && col < cols && row >= 0 && row < rows) {
                            const idx = col + row * cols;
                            if (scale > zBuffer[idx]) {
                                zBuffer[idx] = scale;
                                
                                let br = scale * 2.0;
                                if (audio > 0.5) br *= 1.6;
                                if (cfg.type === 'petal' && progress > 0.8) br *= 1.8;
                                br += Math.sin(time * 3 + idx * 0.1) * 0.3;

                                let r = pdColor.r;
                                let g = pdColor.g;
                                let b = pdColor.b;
                                
                                const bgR = gridColors[idx*3];
                                const bgG = gridColors[idx*3+1];
                                const bgB = gridColors[idx*3+2];

                                if (bgR > 10 || bgG > 10 || bgB > 10) {
                                    if (chaos > 0.7) {
                                        r = Math.abs(r - bgR);
                                        g = Math.abs(g - bgG);
                                        b = Math.abs(b - bgB);
                                    } else {
                                        r = Math.min(255, r + bgR * 0.8);
                                        g = Math.min(255, g + bgG * 0.8);
                                        b = Math.min(255, b + bgB * 0.8);
                                    }
                                }

                                gridChars[idx] = EMPTY_CHAR;
                                gridColors[idx*3] = Math.min(255, r * br);
                                gridColors[idx*3+1] = Math.min(255, g * br);
                                gridColors[idx*3+2] = Math.min(255, b * br);
                                gridMeta[idx] = 1; 
                                gridGlow[idx] = br > 1.0 ? Math.min(2.0, (br - 1.0) * 1.5) : 0;
                            }
                        }
                    }
                }
            }
        };

        p5Instance.current = new p5(sketch, containerRef.current);

        return () => {
             if (p5Instance.current) {
                document.querySelectorAll('video').forEach(v => v.remove());
                 p5Instance.current.remove();
             }
        };
    }, []);

    return <div ref={containerRef} className="absolute inset-0 z-0 bg-black" />;
}

export default Visualizer;
