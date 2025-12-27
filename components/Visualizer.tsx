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
            let movingLotus: any = null;
            let glitchOffset: Int16Array;
            let handDistance = 0.5;
            let blurBuffer: p5.Graphics;
            let bloomBuffer: p5.Graphics;
            let rippleTrails: any[] = [];
            let charVelX: Float32Array;
            let charVelY: Float32Array;
            let charAccelX: Float32Array;
            let charAccelY: Float32Array;
            let charBaseX: Float32Array;
            let charBaseY: Float32Array;
            let physicsParticles: any[] = [];

            const EMPTY_CHAR = "空";

            const frutigerAero = [
                { r: 135, g: 206, b: 250 },
                { r: 176, g: 224, b: 230 },
                { r: 173, g: 216, b: 230 },
                { r: 175, g: 238, b: 238 },
                { r: 144, g: 238, b: 144 },
                { r: 152, g: 251, b: 152 },
                { r: 176, g: 196, b: 222 },
                { r: 176, g: 224, b: 230 }
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
            let invertFrame = false;
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
            let drawFrameSkip = 0;
            
            const initCamera = async () => {
                if (cameraInitialized) return;
                try {
                    await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    capture = p.createCapture(p.VIDEO);
                    capture.size(120, 90);
                    capture.hide();
                } catch (e) {
                    // no camera
                }
                cameraInitialized = true;
            };
            
            p.setup = () => {
                p.createCanvas(p.windowWidth, p.windowHeight);
                (p.drawingContext as CanvasRenderingContext2D).font = `bold ${fontSize}px "Space Mono", monospace`;
                p.textAlign(p.CENTER, p.CENTER);
                p.noStroke();
                p.frameRate(24);

                calculateGrid();

                blurBuffer = p.createGraphics(p.width, p.height);
                bloomBuffer = p.createGraphics(p.width, p.height);

                movingLotus = {
                    x: p.width * 0.3 + Math.random() * p.width * 0.4,
                    y: p.height * 0.3 + Math.random() * p.height * 0.4,
                    bloomProgress: 0,
                    angle: Math.random() * Math.PI * 2,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    petals: []
                };
            };

            p.windowResized = () => {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
                calculateGrid();

                blurBuffer = p.createGraphics(p.width, p.height);
                bloomBuffer = p.createGraphics(p.width, p.height);

                if (movingLotus) {
                    movingLotus.x = Math.max(50, Math.min(p.width - 50, movingLotus.x));
                    movingLotus.y = Math.max(50, Math.min(p.height - 50, movingLotus.y));
                }
            };

            (p as any).touchStarted = () => {
                initCamera();
                touchX = p.mouseX / p.width;
                touchY = p.mouseY / p.height;
                isDragging = true;
                audioEngine.triggerInteraction();
                updateGlitchMap(true);
                audioEngine.setChaos(1.0);
                
                if (ripples.length < 8) {
                    ripples.push({
                        x: p.mouseX,
                        y: p.mouseY,
                        radius: 0,
                        life: 0,
                        maxLife: 120 + Math.random() * 40,
                        strength: 0.8 + Math.random() * 0.4,
                        velocity: 2.5 + Math.random() * 1.5,
                        amplitude: 10 + Math.random() * 6,
                        phase: Math.random() * Math.PI * 2,
                        frequency: 0.15 + Math.random() * 0.1,
                        interference: Math.random() * 0.5
                    });
                }

                for(let i = 0; i < 5; i++) {
                    floatingAscii.push({
                        x: p.mouseX,
                        y: p.mouseY,
                        char: EMPTY_CHAR,
                        life: 45,
                        vx: (Math.random() - 0.5) * 6,
                        vy: (Math.random() - 0.5) * 6 - 1.5
                    });
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
                audioEngine.triggerInteraction();
                updateGlitchMap(true);
                audioEngine.setChaos(1.0);
                
                if (ripples.length < 8) {
                    ripples.push({
                        x: p.mouseX,
                        y: p.mouseY,
                        radius: 0,
                        life: 0,
                        maxLife: 120 + Math.random() * 40,
                        strength: 0.8 + Math.random() * 0.4,
                        velocity: 2.5 + Math.random() * 1.5,
                        amplitude: 10 + Math.random() * 6,
                        phase: Math.random() * Math.PI * 2,
                        frequency: 0.15 + Math.random() * 0.1,
                        interference: Math.random() * 0.5
                    });
                }
                
                for(let i = 0; i < 4; i++) {
                    floatingAscii.push({
                        x: p.mouseX,
                        y: p.mouseY,
                        char: EMPTY_CHAR,
                        life: 40,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5 - 1.5
                    });
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
                audioEngine.triggerInteraction();
                updateGlitchMap(true);
                audioEngine.setChaos(1.0);
            };

            const calculateGrid = () => {
                cols = Math.floor(p.width / fontSize) + 1;
                rows = Math.floor(p.height / (fontSize * 0.65)) + 1; 
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
                    charBaseX[i] = (i % cols) * fontSize;
                    charBaseY[i] = Math.floor(i / cols) * (fontSize * 0.65);
                }
                
                glitchRows = new Int16Array(rows).fill(0);
            };

            function updateGlitchMap(force = false) {
                if (!glitchRows || !glitchRows.length) return;

                const chaos = audioEngine.chaos;
                const rate = Math.max(20, 60 - chaos * 50);
                if (!force && p.millis() - glitchUpdateTimer < rate) return;
                glitchUpdateTimer = p.millis();

                if (Math.random() > 0.3) glitchRows.fill(0);

                const slices = Math.floor(Math.random() * 35 + chaos * 20);
                for(let i = 0; i < slices; i++) {
                    const start = Math.floor(Math.random() * rows);
                    const len = Math.floor(Math.random() * rows / 3 + 5);
                    const offset = Math.floor((Math.random() - 0.5) * 300);
                    for(let r = start; r < Math.min(rows, start + len); r++) {
                        glitchRows[r] = offset;
                    }
                }
                
                if (Math.random() > 0.4) {
                    blockGlitch = {
                        x: Math.floor(Math.random() * cols),
                        y: Math.floor(Math.random() * rows),
                        w: Math.floor(Math.random() * 60 + 10),
                        h: Math.floor(Math.random() * 60 + 10),
                        offX: Math.floor((Math.random() - 0.5) * 150),
                        offY: Math.floor((Math.random() - 0.5) * 150)
                    };
                } else {
                    blockGlitch = { x:0, y:0, w:0, h:0, offX:0, offY:0 };
                }
            }

            function processMotion() {
                if (!capture || !capture.width) return;

                motionFrameSkip++;
                if (motionFrameSkip % 6 !== 0) return;
                
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

                    const sampleStep = 48;
                    
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

                    if (shakeAccumulator > 2.5) {
                        shakeAccumulator = 0;
                        audioEngine.triggerModeSwitch();
                        invertFrame = !invertFrame; 
                        updateGlitchMap(true);
                    }

                    audioEngine.updateSpatialParams(leftHandY, rightHandY, 0);

                } catch (e) {}
            }

            function getPostDigitalColor(t: number, kick: number, chaos: number) {
                const speed = 0.15 + chaos * 0.1;
                const idx = Math.floor(t * speed % frutigerAero.length);
                const next = (idx + 1) % frutigerAero.length;
                const blend = (t * speed) % 1;
                const wave = Math.sin(t * 2) * 0.3 + 0.7;
                const chaosWave = Math.sin(t * 1.5 + chaos) * 0.2 + 0.8;

                let r = p.lerp(frutigerAero[idx].r, frutigerAero[next].r, blend) * wave * chaosWave;
                let g = p.lerp(frutigerAero[idx].g, frutigerAero[next].g, blend) * wave * chaosWave;
                let b = p.lerp(frutigerAero[idx].b, frutigerAero[next].b, blend) * wave * chaosWave;

                if (kick > 0.5) {
                    const pulse = Math.sin(t * 5) * 0.15 + 0.85;
                    r *= pulse;
                    g *= pulse;
                    b *= pulse;
                }

                return {
                    r: Math.max(100, Math.min(255, r)),
                    g: Math.max(120, Math.min(255, g)),
                    b: Math.max(160, Math.min(255, b))
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

                    if (stutterActive) {
                        stutterDuration--;
                        if (stutterDuration <= 0) stutterActive = false;
                    } else {
                        const stutterChance = (chaos > 0.4 && kickVol > 0.6 && p.random() < 0.25) || (chaos > 0.6 && p.random() < 0.2) || (kickVol > 0.8 && p.random() < 0.15);
                        if (stutterChance) {
                            stutterActive = true;
                            stutterDuration = Math.floor(p.random(2, 4));
                            invertFrame = !invertFrame;

                            for(let i = 0; i < 5; i++) {
                                floatingAscii.push({
                                    x: Math.random() * p.width,
                                    y: Math.random() * p.height,
                                    char: EMPTY_CHAR,
                                    life: 20,
                                    vx: (Math.random() - 0.5) * 8,
                                    vy: (Math.random() - 0.5) * 8
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

                    ripples = ripples.filter(ripple => {
                        ripple.life++;
                        ripple.radius += ripple.velocity;
                        ripple.velocity *= 0.999;
                        ripple.strength *= 0.99;
                        ripple.phase += 0.12;
                        
                        if (ripple.life % 2 === 0 && ripple.radius > 15) {
                            rippleTrails.push({
                                x: ripple.x + (Math.random() - 0.5) * 10,
                                y: ripple.y + (Math.random() - 0.5) * 10,
                                radius: ripple.radius,
                                alpha: 180,
                                life: 20
                            });
                        }
                        
                        return ripple.life < ripple.maxLife;
                    });

                    rippleTrails = rippleTrails.filter(trail => {
                        trail.life--;
                        trail.alpha *= 0.88;
                        trail.radius += 2;
                        return trail.life > 0 && trail.alpha > 3;
                    });

                    const shakeAmt = (bass * 0.1) + (chaos * 0.2);
                    targetRotX += (p.random(-shakeAmt, shakeAmt));
                    targetRotY += (p.random(-shakeAmt, shakeAmt));

                    if (!stutterActive) {
                        processMotion();
                        p.background(0);
                        
                        if (leftHandActive) {
                            targetRotY = (leftHandY - 0.5) * 4;
                        } else {
                            targetRotY *= 0.95;
                        }

                        if (rightHandActive) {
                            targetRotX = (rightHandY - 0.5) * 4;
                        } else {
                            targetRotX = Math.sin(globalTime * 0.5) * 0.3;
                        }
                        
                        zoomLevel = p.lerp(zoomLevel, targetZoom, 0.2);

                        if (leftHandActive || rightHandActive) {
                            if (Math.random() > 0.95) {
                                const pdColor = getPostDigitalColor(globalTime, kickVol, chaos);
                                floatingPetals.push({
                                    x: p.width * 0.5 + (Math.random() - 0.5) * 200,
                                    y: p.height * 0.5 + (Math.random() - 0.5) * 200,
                                    size: 20 + Math.random() * 30,
                                    angle: Math.random() * Math.PI * 2,
                                    vx: (Math.random() - 0.5) * 2,
                                    vy: (Math.random() - 0.5) * 2,
                                    va: (Math.random() - 0.5) * 0.1,
                                    life: 200 + Math.random() * 100,
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
                        
                        if (movingLotus) {
                            movingLotus.x += movingLotus.vx;
                            movingLotus.y += movingLotus.vy;
                            movingLotus.angle += 0.01;
                            
                            if (movingLotus.x < 50 || movingLotus.x > p.width - 50) {
                                movingLotus.vx *= -1;
                                movingLotus.x = Math.max(50, Math.min(p.width - 50, movingLotus.x));
                            }
                            if (movingLotus.y < 50 || movingLotus.y > p.height - 50) {
                                movingLotus.vy *= -1;
                                movingLotus.y = Math.max(50, Math.min(p.height - 50, movingLotus.y));
                            }
                            
                            movingLotus.vx += (Math.random() - 0.5) * 0.05;
                            movingLotus.vy += (Math.random() - 0.5) * 0.05;
                            movingLotus.vx = Math.max(-2, Math.min(2, movingLotus.vx));
                            movingLotus.vy = Math.max(-2, Math.min(2, movingLotus.vy));
                            
                            movingLotus.bloomProgress = Math.min(1, movingLotus.bloomProgress + 0.001);
                            
                            const targetPetals = Math.floor(movingLotus.bloomProgress * 12);
                            while (movingLotus.petals.length < targetPetals) {
                                const petalAngle = (movingLotus.petals.length / 12) * Math.PI * 2;
                                movingLotus.petals.push({
                                    angle: petalAngle,
                                    size: 0,
                                    life: 0,
                                    baseSize: 15 + Math.random() * 10
                                });
                            }
                            
                            for (const petal of movingLotus.petals) {
                                petal.life++;
                                if (petal.size < petal.baseSize) {
                                    petal.size = Math.min(petal.baseSize, petal.life * 0.5);
                                }
                            }
                        }
                        
                        rotX = p.lerp(rotX, targetRotX, 0.2);
                        rotY = p.lerp(rotY, targetRotY, 0.2);

                        const cx = Math.cos(rotX + (bass * 0.5));
                        const sx = Math.sin(rotX + (bass * 0.5));
                        const cy = Math.cos(rotY + (mid * 0.5));
                        const sy = Math.sin(rotY + (mid * 0.5));

                        zBuffer.fill(-10000);
                        
                        if (kickVol > 0.5 || mid > 0.6) updateGlitchMap(false);
                        
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
                                            
                                            const pdColor = getPostDigitalColor(globalTime, kickVol, chaos);
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
                                    const pdColor = getPostDigitalColor(globalTime, kickVol, chaos);
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
                        
                        const rippleGlitchIntensity = Math.min(1, ripples.length * 0.2 + ripples.reduce((sum, r) => sum + (r.strength * (1 - r.life / r.maxLife)), 0) * 0.4);
                        const wildFactor = 1.0 + (chaos * 0.8) + (kickVol * 0.6);
                        
                        if (chaos > 0.3 || kickVol > 0.5 || rippleGlitchIntensity > 0.2 || Math.random() > 0.7) {
                            const baseGlitch = Math.floor((chaos + kickVol) * 15 * wildFactor);
                            const rippleGlitch = Math.floor(rippleGlitchIntensity * 25 * wildFactor);
                            const randomGlitch = Math.floor(Math.random() * 20 * wildFactor);
                            const glitchAmount = baseGlitch + rippleGlitch + randomGlitch;
                            
                            for(let g = 0; g < glitchAmount; g++) {
                                const idx = Math.floor(Math.random() * size);
                                if (gridChars[idx]) {
                                    const rippleInfluence = ripples.some(r => {
                                        const dx = (idx % cols) * fontSize - r.x;
                                        const dy = Math.floor(idx / cols) * (fontSize * 0.65) - r.y;
                                        return Math.sqrt(dx * dx + dy * dy) < r.radius * 2.5;
                                    }) ? 2.0 : 1;
                                    
                                    const wildOffset = (Math.random() - 0.5) * 50 * rippleInfluence * wildFactor;
                                    glitchOffset[idx] = Math.floor(wildOffset);
                                    
                                    if (Math.random() > 0.5 && rippleInfluence > 1.5) {
                                        const row = Math.floor(idx / cols);
                                        const chopRange = Math.floor(3 + Math.random() * 4);
                                        for(let r = Math.max(0, row - chopRange); r <= Math.min(rows - 1, row + chopRange); r++) {
                                            const glitchIdx = (idx % cols) + r * cols;
                                            if (glitchIdx >= 0 && glitchIdx < size) {
                                                const chopOffset = (Math.random() - 0.5) * 40 * rippleInfluence * wildFactor;
                                                glitchOffset[glitchIdx] = Math.floor(chopOffset);
                                                
                                                if (Math.random() > 0.8) {
                                                    gridChars[glitchIdx] = "";
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (leftHandActive || rightHandActive || Math.random() > 0.6) {
                            const handGlitch = Math.floor((Math.abs(leftHandY - rightHandY) + chaos + rippleGlitchIntensity + Math.random()) * 12 * wildFactor);
                            for(let g = 0; g < handGlitch; g++) {
                                const idx = Math.floor(Math.random() * size);
                                if (gridChars[idx]) {
                                    const springOffset = (Math.random() - 0.5) * 35 * wildFactor;
                                    glitchOffset[idx] = Math.floor(springOffset);
                                    
                                    if (Math.random() > 0.7) {
                                        const row = Math.floor(idx / cols);
                                        const col = idx % cols;
                                        for(let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
                                            for(let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
                                                const springIdx = c + r * cols;
                                                if (springIdx >= 0 && springIdx < size && Math.random() > 0.5) {
                                                    glitchOffset[springIdx] = Math.floor((Math.random() - 0.5) * 25 * wildFactor);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        for (const ripple of ripples) {
                            if (ripple.radius > 20 && Math.random() > 0.85) {
                                const rippleGlitchX = ripple.x + (Math.random() - 0.5) * ripple.radius * 1.2;
                                const rippleGlitchY = ripple.y + (Math.random() - 0.5) * ripple.radius * 1.2;
                                const glitchCol = Math.floor(rippleGlitchX / fontSize);
                                const glitchRow = Math.floor(rippleGlitchY / (fontSize * 0.65));
                                
                                if (glitchCol >= 0 && glitchCol < cols && glitchRow >= 0 && glitchRow < rows) {
                                    const glitchIdx = glitchCol + glitchRow * cols;
                                    if (glitchIdx >= 0 && glitchIdx < size && gridChars[glitchIdx]) {
                                        const waveGlitch = Math.sin(ripple.phase + globalTime * 5) * ripple.strength * 40 * wildFactor;
                                        glitchOffset[glitchIdx] = Math.floor(waveGlitch);
                                        
                                        if (Math.random() > 0.7) {
                                            const row = glitchRow;
                                            for(let r = Math.max(0, row - 2); r <= Math.min(rows - 1, row + 2); r++) {
                                                const chopIdx = glitchCol + r * cols;
                                                if (chopIdx >= 0 && chopIdx < size && Math.random() > 0.6) {
                                                    glitchOffset[chopIdx] = Math.floor((Math.random() - 0.5) * 30 * wildFactor);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (kickVol > 0.6 || chaos > 0.7) {
                            const wildChopAmount = Math.floor((kickVol + chaos) * 30 * wildFactor);
                            for(let c = 0; c < wildChopAmount; c++) {
                                const idx = Math.floor(Math.random() * size);
                                if (gridChars[idx]) {
                                    const chopType = Math.random();
                                    if (chopType < 0.4) {
                                        gridChars[idx] = "";
                                    } else if (chopType < 0.7) {
                                        glitchOffset[idx] = Math.floor((Math.random() - 0.5) * 60 * wildFactor);
                                    } else {
                                        const row = Math.floor(idx / cols);
                                        const col = idx % cols;
                                        for(let r = Math.max(0, row - 3); r <= Math.min(rows - 1, row + 3); r++) {
                                            for(let c = Math.max(0, col - 2); c <= Math.min(cols - 1, col + 2); c++) {
                                                const chopIdx = c + r * cols;
                                                if (chopIdx >= 0 && chopIdx < size && Math.random() > 0.4) {
                                                    glitchOffset[chopIdx] = Math.floor((Math.random() - 0.5) * 35 * wildFactor);
                                                    if (Math.random() > 0.7) {
                                                        gridChars[chopIdx] = "";
                                                    }
                                                }
                                            }
                                        }
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
                        
                        const pdColor = getPostDigitalColor(globalTime, kickVol, chaos);
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
                        
                        if (movingLotus) {
                            renderMovingLotus(movingLotus, globalTime, pdColor, kickVol);
                        }
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
                        const colorIdx = Math.floor((globalTime * 1 + f.life * 0.1) % frutigerAero.length);
                        const color = frutigerAero[colorIdx];
                        p.fill(color.r, color.g, color.b, alpha);
                        p.text(f.char, f.x, f.y);
                    }
                    
                    for (const particle of physicsParticles) {
                        const alpha = (particle.life / 100) * 120;
                        const colorIdx = Math.floor((globalTime * 0.8 + particle.life * 0.05) % frutigerAero.length);
                        const color = frutigerAero[colorIdx];
                        const size = 3 + (particle.mass / 50) * 2;
                        p.fill(color.r, color.g, color.b, alpha);
                        p.noStroke();
                        p.circle(particle.x, particle.y, size);
                        p.fill(color.r * 1.5, color.g * 1.5, color.b * 1.5, alpha * 0.3);
                        p.circle(particle.x, particle.y, size * 2);
                    }
                    
                    if (blurBuffer && bloomBuffer) {
                        blurBuffer.clear();
                        bloomBuffer.clear();
                        blurBuffer.background(0, 0);
                        bloomBuffer.background(0, 0);
                    }
                    
                    for (const ripple of ripples) {
                        const progress = ripple.life / ripple.maxLife;
                        const fade = 1 - progress;
                        const colorIdx = Math.floor((globalTime * 0.3 + ripple.phase) % frutigerAero.length);
                        const color = frutigerAero[colorIdx];
                        
                        const waveLayers = 5;
                        for (let layer = 0; layer < waveLayers; layer++) {
                            const layerProgress = (progress + layer * 0.15) % 1;
                            const layerRadius = ripple.radius * (1 - layer * 0.12);
                            const layerAlpha = fade * (1 - layer * 0.15) * (1 - layerProgress * 0.7) * 120;
                            
                            if (layerAlpha > 3 && layerRadius > 8) {
                                const waveFrequency = ripple.frequency * (1 + layer * 0.1);
                                const wavePhase = layerProgress * Math.PI * 2 + ripple.phase;
                                const waveAmplitude = ripple.amplitude * (1 - layerProgress) * Math.sin(wavePhase * 0.5);
                                
                                const interference = ripple.interference * Math.sin(globalTime * 2 + ripple.phase);
                                const chromaticOffset = layer * 2;
                                
                                p.strokeWeight(1.5 - layer * 0.2);
                                
                                const segments = 128;
                                for (let s = 0; s < segments; s++) {
                                    const angle = (s / segments) * Math.PI * 2;
                                    const baseRadius = layerRadius;
                                    
                                    const radialWave = Math.sin(angle * 12 + wavePhase) * waveAmplitude * 0.4;
                                    const interferenceWave = Math.sin(angle * 6 + interference) * ripple.interference * 8;
                                    const timeWave = Math.sin(angle * 3 + globalTime * 3) * 2;
                                    
                                    const r = baseRadius + radialWave + interferenceWave + timeWave;
                                    
                                    const x = ripple.x + Math.cos(angle) * r;
                                    const y = ripple.y + Math.sin(angle) * r;
                                    
                                    const distFromCenter = Math.sqrt((x - ripple.x) ** 2 + (y - ripple.y) ** 2);
                                    const waveIntensity = Math.sin(distFromCenter * waveFrequency - wavePhase) * 0.5 + 0.5;
                                    
                                    const rChannel = Math.min(255, color.r + chromaticOffset * waveIntensity);
                                    const gChannel = Math.min(255, color.g);
                                    const bChannel = Math.min(255, color.b - chromaticOffset * waveIntensity);
                                    
                                    p.stroke(rChannel, gChannel, bChannel, layerAlpha * waveIntensity);
                                    p.point(x, y);
                                    
                                    if (layer === 0 && s % 4 === 0) {
                                        bloomBuffer.stroke(rChannel * 1.5, gChannel * 1.5, bChannel * 1.5, layerAlpha * 0.3);
                                        bloomBuffer.strokeWeight(3);
                                        bloomBuffer.point(x, y);
                                    }
                                }
                            }
                        }
                        
                        for (const otherRipple of ripples) {
                            if (otherRipple === ripple) continue;
                            const dx = ripple.x - otherRipple.x;
                            const dy = ripple.y - otherRipple.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist < (ripple.radius + otherRipple.radius) * 0.8 && dist > 10) {
                                const interferenceAngle = Math.atan2(dy, dx);
                                const interferenceStrength = (1 - dist / ((ripple.radius + otherRipple.radius) * 0.8)) * 0.6;
                                
                                for (let i = 0; i < 20; i++) {
                                    const angle = interferenceAngle + (Math.random() - 0.5) * 0.5;
                                    const r = (ripple.radius + otherRipple.radius) * 0.5;
                                    const x = (ripple.x + otherRipple.x) * 0.5 + Math.cos(angle) * r;
                                    const y = (ripple.y + otherRipple.y) * 0.5 + Math.sin(angle) * r;
                                    
                                    const glitchColor = frutigerAero[Math.floor((globalTime * 2 + i) % frutigerAero.length)];
                                    p.stroke(glitchColor.r, glitchColor.g, glitchColor.b, interferenceStrength * 100);
                                    p.strokeWeight(1);
                                    p.point(x, y);
                                }
                            }
                        }
                    }
                    
                    for (const trail of rippleTrails) {
                        const trailAlpha = trail.alpha * 0.4;
                        const color = frutigerAero[Math.floor(globalTime * 0.4) % frutigerAero.length];
                        p.stroke(color.r, color.g, color.b, trailAlpha);
                        p.strokeWeight(1);
                        p.noFill();
                        p.circle(trail.x, trail.y, trail.radius * 2);
                    }
                    
                    p.noStroke();
                    
                    if (ripples.length > 0) {
                        p.push();
                        p.blendMode(p.SCREEN);
                        p.tint(255, 140);
                        p.image(bloomBuffer, 0, 0);
                        p.pop();
                        
                        p.push();
                        p.blendMode(p.OVERLAY);
                        p.tint(255, 80);
                        p.image(blurBuffer, 0, 0);
                        p.pop();
                        
                        p.push();
                        p.blendMode(p.ADD);
                        p.tint(255, 40);
                        p.image(bloomBuffer, 0, 0);
                        p.pop();
                    }


                    const dt = 1.0 / 24.0;
                    const springConstant = 0.15;
                    const damping = 0.88;
                    const viscosity = 0.92;
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

                        if (invertFrame) {
                            r = 255 - r;
                            g = 255 - g;
                            b = 255 - b;
                        }

                            const ctx = p.drawingContext as CanvasRenderingContext2D;
                        if (isLotus) {
                            const glow = gridGlow[i];
                                ctx.shadowBlur = Math.max(0, glow * 25 + 8);
                                ctx.shadowColor = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},0.8)`;
                                p.fill(Math.floor(r), Math.floor(g), Math.floor(b), 255);
                        } else {
                                const baseAlpha = Math.min(255, (chaos > 0.5) ? 180 : 240);
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
                        
                        for (const ripple of ripples) {
                            const dx = currentX - ripple.x;
                            const dy = currentY - ripple.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist < ripple.radius * 3 && dist > 0.1) {
                                const angle = Math.atan2(dy, dx);
                                const waveDist = dist - ripple.radius;
                                const progress = ripple.life / ripple.maxLife;
                                const fade = 1 - progress;
                                
                                const waveForce = Math.sin(waveDist * ripple.frequency * 2 - ripple.phase) * ripple.strength * fade;
                                const radialForce = Math.sin(dist * 0.2 + globalTime * 3) * ripple.amplitude * 0.3;
                                const totalForce = (waveForce + radialForce) * fade * (1 + audioForce);
                                
                                const forceX = Math.cos(angle) * totalForce * 0.8;
                                const forceY = Math.sin(angle) * totalForce * 0.8;
                                
                                charAccelX[i] += forceX;
                                charAccelY[i] += forceY;
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
                        
                        for (const ripple of ripples) {
                            const dx = particle.x - ripple.x;
                            const dy = particle.y - ripple.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < ripple.radius * 2 && dist > 0.1) {
                                const angle = Math.atan2(dy, dx);
                                const force = ripple.strength * (1 - dist / (ripple.radius * 2)) * 2;
                                particle.ax += Math.cos(angle) * force;
                                particle.ay += Math.sin(angle) * force;
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
                    
                    for (let i = 0; i < size; i++) {
                        const char = gridChars[i];
                        if (!char || char === "") continue;

                        let x = charBaseX[i] + charVelX[i] + glitchOffset[i];
                        let y = charBaseY[i] + charVelY[i];
                        
                        let rippleOffsetX = 0;
                        let rippleOffsetY = 0;
                        let chromaticR = 0;
                        let chromaticG = 0;
                        let chromaticB = 0;
                        let blurAmount = 0;
                        
                        for (const ripple of ripples) {
                            const dx = x - ripple.x;
                            const dy = y - ripple.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const angle = Math.atan2(dy, dx);
                            const waveDist = dist - ripple.radius;
                            
                            if (dist < ripple.radius * 2.5) {
                                const progress = ripple.life / ripple.maxLife;
                                const fade = 1 - progress;
                                
                                const wildSpeed = 1.0 + (chaos * 0.8) + (kickVol * 0.6);
                                const primaryWave = Math.sin(waveDist * ripple.frequency * 1.5 - ripple.phase * wildSpeed) * ripple.strength * fade;
                                const secondaryWave = Math.sin(waveDist * ripple.frequency * 3 - ripple.phase * 2 * wildSpeed) * ripple.strength * 0.6 * fade;
                                const radialWave = Math.sin(dist * 0.25 + globalTime * 4 * wildSpeed + ripple.phase) * ripple.amplitude * 0.2;
                                const interferenceWave = Math.sin(angle * 12 + ripple.interference + globalTime * 3) * ripple.interference * 5;
                                const springWave = Math.sin(dist * 0.3 + globalTime * 5) * (kickVol + chaos) * 4;
                                
                                const totalWave = (primaryWave + secondaryWave + radialWave + interferenceWave + springWave) * fade;
                                
                                rippleOffsetX += Math.cos(angle) * totalWave * 25 * wildSpeed;
                                rippleOffsetY += Math.sin(angle) * totalWave * 25 * wildSpeed;
                                
                                const springX = (Math.random() - 0.5) * (kickVol + chaos) * 8;
                                const springY = (Math.random() - 0.5) * (kickVol + chaos) * 8;
                                rippleOffsetX += springX;
                                rippleOffsetY += springY;
                                
                                const chromaticIntensity = Math.abs(totalWave) * 0.3;
                                const colorShift = Math.sin(dist * 0.1 + ripple.phase) * chromaticIntensity;
                                chromaticR += colorShift * 15;
                                chromaticB -= colorShift * 15;
                                
                                blurAmount += Math.abs(totalWave) * fade * 0.8;
                            }
                        }
                        
                        for (let i = 0; i < ripples.length; i++) {
                            for (let j = i + 1; j < ripples.length; j++) {
                                const r1 = ripples[i];
                                const r2 = ripples[j];
                                const dx1 = x - r1.x;
                                const dy1 = y - r1.y;
                                const dx2 = x - r2.x;
                                const dy2 = y - r2.y;
                                const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                                const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                                
                                if (dist1 < r1.radius * 1.5 && dist2 < r2.radius * 1.5) {
                                    const interference = Math.sin((dist1 - dist2) * 0.2 + globalTime) * 0.4;
                                    const interferenceAngle = Math.atan2((dy1 + dy2) * 0.5, (dx1 + dx2) * 0.5);
                                    rippleOffsetX += Math.cos(interferenceAngle) * interference * 12;
                                    rippleOffsetY += Math.sin(interferenceAngle) * interference * 12;
                                    blurAmount += Math.abs(interference) * 1.2;
                                }
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

                        if (invertFrame) {
                            r = 255 - r;
                            g = 255 - g;
                            b = 255 - b;
                        }

                        const rippleProximity = ripples.reduce((min, ripple) => {
                            const dx = x - ripple.x;
                            const dy = y - ripple.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            return Math.min(min, dist);
                        }, Infinity);
                        
                        const rippleInfluence = rippleProximity < 200 ? (1 - rippleProximity / 200) : 0;
                        const dreamyBlur = rippleInfluence * 0.3;
                        const dreamyGlow = rippleInfluence * 0.5;

                        if (isLotus) {
                            const glow = gridGlow[i] + dreamyGlow;
                            ctx.shadowBlur = Math.max(0, glow * 25 + 8 + dreamyBlur * 15); 
                            ctx.shadowColor = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${0.8 + dreamyGlow * 0.1})`;
                            p.fill(Math.floor(r), Math.floor(g), Math.floor(b), 255);
                            p.text(char, x, y);
                        } else {
                            const baseAlpha = Math.min(255, (chaos > 0.5) ? 180 : 240);
                            const alpha = Math.min(255, baseAlpha + dreamyGlow * 30);
                            ctx.shadowBlur = Math.max(0, dreamyBlur * 12);
                            ctx.shadowColor = `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${dreamyGlow * 0.25})`;
                            p.fill(Math.floor(r), Math.floor(g), Math.floor(b), Math.floor(alpha));
                            p.text(char, x, y);
                        }
                    }
                } catch(e) { }
            };

            function renderMovingLotus(lotus: any, time: number, pdColor: any, kickVol: number) {
                p.push();
                p.translate(lotus.x, lotus.y);
                p.rotate(lotus.angle);
                
                const pulse = 1.0 + Math.sin(time * 2) * 0.1 + kickVol * 0.2;
                const centerSize = 8 * pulse;
                
                p.fill(pdColor.r, pdColor.g, pdColor.b, 200);
                p.textSize(centerSize);
                p.text(EMPTY_CHAR, 0, 0);
                
                for (const petal of lotus.petals) {
                    if (petal.size < 1) continue;
                    
                    const petalDist = 25 + petal.size * 0.5;
                    const px = Math.cos(petal.angle) * petalDist;
                    const py = Math.sin(petal.angle) * petalDist;
                    
                    const petalPulse = 1.0 + Math.sin(time * 3 + petal.angle) * 0.15;
                    const finalSize = petal.size * petalPulse;
                    
                    const colorIdx = Math.floor((time * 0.3 + petal.angle) % frutigerAero.length);
                    const color = frutigerAero[colorIdx];
                    
                    p.push();
                    p.translate(px, py);
                    p.rotate(petal.angle + Math.PI / 2);
                    p.fill(color.r, color.g, color.b, 180);
                    p.textSize(finalSize);
                    p.text(EMPTY_CHAR, 0, 0);
                    p.pop();
                }
                
                p.pop();
            }

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