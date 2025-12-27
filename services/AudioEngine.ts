export class AudioEngine {
    ctx: AudioContext | null = null;
    masterGain: GainNode | null = null;
    busGain: GainNode | null = null;
    analyser: AnalyserNode | null = null;
    isSetup: boolean = false;
    isPlaying: boolean = false;
    tempo: number = 95;
    baseTempo: number = 95;
    nextNoteTime: number = 0;
    timerID: number | null = null;
    current16thNote: number = 0;
    scheduleAheadTime: number = 0.1;
    lookahead: number = 25;
    volumeRAF: number | null = null;
    globalVolume: number = 0;
    targetVolume: number = 0;
    delayNode: DelayNode | null = null;
    feedbackGain: GainNode | null = null;
    delayReturnGain: GainNode | null = null;
    distortionNode: WaveShaperNode | null = null;
    filterNode: BiquadFilterNode | null = null;
    reverbNode: ConvolverNode | null = null;
    reverbGain: GainNode | null = null;
    droneOsc: OscillatorNode | null = null;
    droneFilter: BiquadFilterNode | null = null;
    droneLFO: OscillatorNode | null = null;
    modX: number = 0;
    modY: number = 0;
    chaos: number = 0;
    scale: number[] = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66, 349.23, 392.00, 440.0, 523.25];
    measureCount: number = 0;
    blendMode: 'deep' | 'glitch' | 'drive' = 'deep';
    kickPattern: number[] = [];
    snarePattern: number[] = [];
    probabilityMask: number[] = [];
    microTiming: number[] = [];

    isIOS(): boolean {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    constructor() {
        this.regeneratePatterns();
    }

    async init() {
        const ua = navigator.userAgent;
        const isIOS = this.isIOS();
        console.log('[Audio] Init start', { ua, isIOS, hasAudioContext: !!window.AudioContext, hasWebkit: !!(window as any).webkitAudioContext });

        if (!this.isSetup) {
            const AC = window.AudioContext || (window as any).webkitAudioContext;
            try {
                this.ctx = new AC();
                console.log('[Audio] AudioContext created', { state: this.ctx.state, sampleRate: this.ctx.sampleRate });
            } catch (e) {
                console.error('[Audio] Failed to create AudioContext', e);
                return;
            }

            this.busGain = this.ctx.createGain();
            this.busGain.gain.value = 1.0;

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0;

            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.85;

            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);

            if (this.ctx.state === 'suspended') {
                console.log('[Audio] Context suspended, resuming...');
                try {
                    await this.ctx.resume();
                    console.log('[Audio] Context resumed', { state: this.ctx.state });
                } catch (e) {
                    console.error('[Audio] Failed to resume context', e);
                }
            }

            this.setupMasterFX();
            this.setupDrone();
            this.isSetup = true;
            console.log('[Audio] Setup complete', { hasDrone: !!this.droneOsc, hasMasterGain: !!this.masterGain });
        } else {
            if (this.ctx?.state === 'suspended') {
                console.log('[Audio] Context suspended on reinit, resuming...');
                try {
                    await this.ctx.resume();
                    console.log('[Audio] Context resumed', { state: this.ctx.state });
                } catch (e) {
                    console.error('[Audio] Failed to resume context', e);
                }
            }
            if (!this.droneOsc || !this.droneLFO) this.setupDrone();
        }

        this.isPlaying = true;
        if (!this.ctx) {
            console.error('[Audio] No context available');
            return;
        }

        this.targetVolume = 0.95;
        this.globalVolume = 0.95;
        if (this.masterGain) {
            this.masterGain.gain.value = 0.95;
            console.log('[Audio] Master gain set', { gain: this.masterGain.gain.value });
        }

        this.nextNoteTime = this.ctx.currentTime;
        if (!this.timerID) {
            this.scheduler();
            console.log('[Audio] Scheduler started');
        }
        if (!this.volumeRAF) {
            this.volumeLoop();
            console.log('[Audio] Volume loop started');
        }

        console.log('[Audio] Init complete', { 
            state: this.ctx.state, 
            isPlaying: this.isPlaying, 
            hasMasterGain: !!this.masterGain,
            masterGainValue: this.masterGain?.gain.value 
        });
    }


    setChaos(level: number) {
        this.chaos = this.chaos * 0.9 + level * 0.1;
    }

    triggerModeSwitch() {
        if (!this.ctx) return;
        const modes = ['deep', 'glitch', 'drive'];
        const idx = modes.indexOf(this.blendMode);
        this.blendMode = modes[(idx + 1) % modes.length] as any;
        this.regeneratePatterns();
        const t = this.ctx.currentTime;
        this.triggerGlitch(t);
        this.triggerFMBass(t, 55, 1.0);
    }

    triggerInteraction() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const reps = Math.floor(Math.random() * 12) + 6;
        const speed = Math.random() * 0.04 + 0.008;
        const panStart = Math.random() * 2 - 1;
        
        for(let i = 0; i < reps; i++) {
            const t = now + i * speed;
            const pMod = (reps - i) * 500;
            const pan = panStart * (i % 2 === 0 ? 1 : -1);
            if (Math.random() > 0.6) this.triggerGlitch(t);
            else this.triggerHat(t, 0.5, pan, pMod);
        }
        
        this.tempo = this.baseTempo * (Math.random() > 0.5 ? 0.75 : 1.25);
    }

    setupMasterFX() {
        if (!this.ctx || !this.busGain || !this.masterGain) return;

        this.reverbNode = this.ctx.createConvolver();
        setTimeout(() => {
            if (this.ctx && this.reverbNode) {
                this.reverbNode.buffer = this.createImpulseResponse(2.0, 4.0);
            }
        }, 0);
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.4;

        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 20000;
        this.filterNode.Q.value = 1.0;

        this.distortionNode = this.ctx.createWaveShaper();
        this.distortionNode.curve = this.makeDistortionCurve(150);
        this.distortionNode.oversample = '4x';

        this.delayNode = this.ctx.createDelay();
        this.delayNode.delayTime.value = 0.05;
        this.feedbackGain = this.ctx.createGain();
        this.feedbackGain.gain.value = 0.6;

        this.delayReturnGain = this.ctx.createGain();
        this.delayReturnGain.gain.value = 0.55;

        try { this.busGain.disconnect(); } catch {}
        try { this.filterNode.disconnect(); } catch {}
        try { this.distortionNode.disconnect(); } catch {}

        this.busGain.connect(this.filterNode);
        this.filterNode.connect(this.distortionNode);
        this.distortionNode.connect(this.masterGain);
        this.distortionNode.connect(this.reverbNode);
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);
        this.distortionNode.connect(this.delayNode);
        this.delayNode.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delayNode);
        this.delayNode.connect(this.delayReturnGain);
        this.delayReturnGain.connect(this.masterGain);
    }


    setupDrone() {
        if (!this.ctx || !this.reverbNode || !this.busGain) {
            console.warn('[Audio] Cannot setup drone', { hasCtx: !!this.ctx, hasReverb: !!this.reverbNode, hasBus: !!this.busGain });
            return;
        }
        
        try {
            this.droneOsc = this.ctx.createOscillator();
            this.droneOsc.type = 'sawtooth';
            this.droneOsc.frequency.value = 55.0;
            
            this.droneFilter = this.ctx.createBiquadFilter();
            this.droneFilter.type = 'bandpass';
            this.droneFilter.frequency.value = 200;
            this.droneFilter.Q.value = 2;

            const droneGain = this.ctx.createGain();
            droneGain.gain.value = 0.1;

            this.droneLFO = this.ctx.createOscillator();
            this.droneLFO.frequency.value = 0.1;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 100; 

            this.droneLFO.connect(lfoGain);
            lfoGain.connect(this.droneFilter.frequency);

            this.droneOsc.connect(this.droneFilter);
            this.droneFilter.connect(droneGain);
            droneGain.connect(this.busGain);
            droneGain.connect(this.reverbNode);
            
            if (this.ctx.state === 'running') {
                this.droneOsc.start();
                this.droneLFO.start();
                console.log('[Audio] Drone oscillators started');
            } else {
                console.warn('[Audio] Context not running, will start oscillators when resumed', { state: this.ctx.state });
                const startOscillators = () => {
                    if (this.ctx?.state === 'running' && this.droneOsc && this.droneLFO) {
                        try {
                            this.droneOsc.start();
                            this.droneLFO.start();
                            console.log('[Audio] Drone oscillators started after context resume');
                            this.ctx.removeEventListener('statechange', startOscillators);
                        } catch (e) {
                            console.error('[Audio] Failed to start oscillators', e);
                        }
                    }
                };
                this.ctx.addEventListener('statechange', startOscillators);
            }
        } catch (e) {
            console.error('[Audio] Failed to setup drone', e);
        }
    }

    createImpulseResponse(duration: number, decay: number): AudioBuffer {
        if (!this.ctx) { throw new Error('AudioContext not initialized'); }
        const length = this.ctx.sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        const step = Math.max(1, Math.floor(length / 10000));
        for (let i = 0; i < length; i += step) {
            const n = i / length;
            const noise = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
            for (let j = 0; j < step && (i + j) < length; j++) {
                left[i + j] = noise;
                right[i + j] = noise;
            }
        }
        return impulse;
    }

    makeDistortionCurve(amount: number) {
        const k = amount;
        const n_samples = 22050;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    volumeLoop() {
        if (!this.ctx || !this.masterGain) return;
        if (!this.isPlaying) {
            if (this.volumeRAF) {
                cancelAnimationFrame(this.volumeRAF);
                this.volumeRAF = null;
            }
            return;
        }

        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        this.globalVolume = lerp(this.globalVolume, this.targetVolume, 0.05);
        this.masterGain.gain.setTargetAtTime(this.globalVolume, this.ctx.currentTime, 0.1);

        if (Math.abs(this.tempo - this.baseTempo) > 1) {
            this.tempo = lerp(this.tempo, this.baseTempo, 0.01);
        }

        if (this.filterNode) {
            const freq = 400 + Math.pow(this.modY, 2) * 8000 + Math.random() * 500 * this.chaos;
            this.filterNode.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
            this.filterNode.Q.value = 1 + this.modX * 10 + this.chaos * 15;
        }

        if (this.delayNode && this.feedbackGain) {
            const delay = 3 / 16 * (60 / this.tempo);
            const warp = (this.modX > 0.5 || this.chaos > 0.5) ? Math.random() * 0.05 : 0;
            this.delayNode.delayTime.setTargetAtTime(delay + warp, this.ctx.currentTime, 0.05);
            this.feedbackGain.gain.value = 0.5 + this.chaos * 0.4;
        }

        this.volumeRAF = requestAnimationFrame(() => this.volumeLoop());
    }


    setPresence(isPresent: boolean) {
        this.targetVolume = isPresent ? 0.95 : 0.0;
    }

    updateSpatialParams(leftHandY: number, rightHandY: number, balance: number) {
        this.modY = leftHandY; 
        this.modX = Math.abs((rightHandY - 0.5) * 2); 
    }

    regeneratePatterns() {
        this.kickPattern = new Array(16).fill(0);
        this.snarePattern = new Array(16).fill(0);
        this.probabilityMask = new Array(16).fill(0).map(() => Math.random());
        this.microTiming = new Array(16).fill(0).map(() => (Math.random() - 0.5) * 0.02);

        const isDrive = this.blendMode === 'drive';
        const densityMod = isDrive ? 2 : 0;

        const kicks = Math.floor(Math.random() * 4) + 2 + densityMod; 
        for(let i=0; i<kicks; i++) {
            const idx = Math.floor(Math.random() * 16);
            this.kickPattern[idx] = 1;
        }

        const snares = Math.floor(Math.random() * 4) + 1 + densityMod;
        for(let i=0; i<snares; i++) {
             let idx = (Math.random() > 0.5) ? 4 : 12;
             if (Math.random() > 0.3) idx = Math.floor(Math.random() * 16);
             this.snarePattern[idx] = 1;
        }
        
        if (Math.random() > 0.5 && !isDrive) {
             for(let i=0; i<16; i++) {
                 if(this.snarePattern[i] === 1) this.kickPattern[i] = 0;
             }
        }
    }

    scheduler() {
        if (!this.ctx || !this.isPlaying) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            
            const step16 = this.current16thNote % 16;
            const swing = (step16 % 2 === 0) ? 0 : 0.015; 
            const chaosDrift = (Math.random() - 0.5) * (this.chaos * 0.08); 
            const drift = this.microTiming[step16] + chaosDrift;
            
            this.nextNoteTime += ((60.0 / this.tempo) / 4.0) + swing + drift;
            
                this.current16thNote++;
            if (this.current16thNote >= 64) {
                this.current16thNote = 0;
                this.measureCount++;
                if (this.measureCount % 2 === 0) this.regeneratePatterns();
                
                if (this.chaos > 0.7 && Math.random() > 0.5) this.triggerModeSwitch();
                
                if (Math.random() > 0.6) {
                    this.tempo = this.baseTempo * (0.8 + Math.random() * 0.4);
                }
            }
        }
        this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }

    scheduleNote(totalSteps: number, time: number) {
        if (this.globalVolume < 0.01) return;

        const step16 = totalSteps % 16;
        const isGlitchMode = this.blendMode === 'glitch';
        const isDriveMode = this.blendMode === 'drive';
        
        const probThreshold = 0.25 - (this.chaos * 0.2) + (Math.sin(this.measureCount * 0.5) * 0.1);
        if (this.probabilityMask[step16] < probThreshold && !isGlitchMode && !isDriveMode) return; 

        if (this.kickPattern[step16] === 1) {
            if (Math.random() < 0.15) {
                this.triggerKick(time);
            } else {
                this.triggerKick(time);
            }
        }

        if (this.snarePattern[step16] === 1) {
            this.triggerSnare(time + (Math.random() * 0.01), 0.4);
        }

        if ((step16 === 0 || step16 === 8) && totalSteps % 4 !== 0) {
             const pitch = this.scale[Math.floor(Math.random() * 4)];
             const mod = (this.modY + this.chaos) * 0.5 + 0.3;
             this.triggerFMBass(time, pitch, mod);
        }
        
        if (step16 % 8 === 0 && Math.random() > 0.4) {
             const pitch = this.scale[Math.floor(Math.random() * 5) + 2];
             const mod = (this.modY + this.chaos) * 0.4 + 0.2;
             this.triggerFMBass(time + 0.03, pitch * 1.2, mod);
        }

        if (Math.random() < 0.25 + (this.modX * 0.2)) {
            const divs = [3, 5, 7][Math.floor(Math.random() * 3)];
            const dur = (60 / this.tempo) / 4; 
            for(let i=0; i<divs; i++) {
                const vel = (Math.sin(i) + 1) * 0.2; 
                const pan = Math.cos(i * 2 + time) * 0.5;
                const pMod = Math.random() * 2000;
                this.triggerHat(time + (i * (dur/divs)), vel, pan, pMod);
            }
        } else if (step16 % 4 === 0 && Math.random() > 0.5) {
             this.triggerHat(time, 0.15, 0, 0);
        }

        if (Math.random() < 0.05 || (isGlitchMode && Math.random() > 0.7)) {
            this.triggerGlitch(time + (Math.random() * 0.1));
        }

        if (totalSteps % 16 === 0 && Math.random() > 0.2) {
             const pitch = this.scale[Math.floor(Math.random() * this.scale.length)];
             this.triggerPad(time, pitch);
        }
        
        if (totalSteps % 8 === 0 && Math.random() > 0.5) {
             const pitch = this.scale[Math.floor(Math.random() * 6) + 2];
             this.triggerPad(time, pitch * 0.75);
        }
        
        if (step16 % 4 === 0 && Math.random() > 0.6) {
             const pitch = this.scale[Math.floor(Math.random() * 4) + 4];
             this.triggerPad(time, pitch * 1.5);
        }
    }

    triggerKick(time: number) {
        if (!this.ctx || !this.masterGain || !this.busGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.frequency.setValueAtTime(120, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
        
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        const dist = this.ctx.createWaveShaper();
        const distAmt = (this.blendMode === 'drive') ? 200 : 20;
        dist.curve = this.makeDistortionCurve(distAmt + (this.chaos * 30));

        osc.connect(gain);
        gain.connect(dist);
        dist.connect(this.busGain);
        
        osc.start(time);
        osc.stop(time + 0.35);
    }

    triggerSnare(time: number, vol: number = 0.5) {
        if (!this.ctx || !this.masterGain || !this.busGain) return;
        
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, time);
        osc.frequency.linearRampToValueAtTime(100, time + 0.1);
        
        const noise = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for(let i=0; i<bufferSize; i++) data[i] = (Math.random() * 2 - 1);
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1500;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        
        noise.connect(filter);
        filter.connect(gain);
        osc.connect(gain);
        gain.connect(this.busGain);
        if(this.reverbNode) gain.connect(this.reverbNode);

        noise.start(time);
        noise.stop(time + 0.16);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    triggerHat(time: number, vol: number, panPos: number, pitchMod: number) {
        if (!this.ctx || !this.masterGain || !this.busGain) return;
        
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime((8000 + pitchMod) + Math.random()*1000, time);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 10000;
        filter.Q.value = 2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol * 0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

        const panner = this.ctx.createStereoPanner();
        panner.pan.value = panPos;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.busGain);
        
        osc.start(time);
        osc.stop(time + 0.05);
    }

    triggerFMBass(time: number, freq: number, intensity: number) {
        if (!this.ctx || !this.masterGain || !this.busGain) return;
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const outGain = this.ctx.createGain();
        
        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, time);
        modulator.frequency.setValueAtTime(freq * 1.8, time); 
        
        const modIndex = 200 + (intensity * 800);
        modGain.gain.setValueAtTime(modIndex, time);
        modGain.gain.exponentialRampToValueAtTime(1, time + 0.6); 
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        
        const dist = this.ctx.createWaveShaper();
        dist.curve = this.makeDistortionCurve(10 + (intensity * 20));

        outGain.gain.setValueAtTime(0.4, time);
        outGain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
        
        carrier.connect(outGain);
        outGain.connect(dist);
        dist.connect(this.busGain);
        
        carrier.start(time);
        modulator.start(time);
        carrier.stop(time + 0.5);
        modulator.stop(time + 0.5);
    }

    triggerPad(time: number, freq: number) {
        if (!this.ctx || !this.masterGain || !this.busGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();

        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.frequency.exponentialRampToValueAtTime(2500, time + 4); 
        filter.Q.value = 1.5;
        
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.2;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 80;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.15, time + 3);
        gain.gain.linearRampToValueAtTime(0, time + 12.0);

        pan.pan.value = (Math.random() * 1.5) - 0.75;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(pan);
        if(this.busGain) pan.connect(this.busGain);
        if(this.reverbNode) pan.connect(this.reverbNode);

        osc.start(time);
        lfo.start(time);
        osc.stop(time + 12.0);
        lfo.stop(time + 12.0);
    }

    triggerGlitch(time: number) {
        if (!this.ctx || !this.masterGain || !this.busGain) return;
        const bufSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for(let i=0; i<bufSize; i++) {
            data[i] = Math.random() > 0.5 ? 0.5 : -0.5; 
        }
        
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = 0.5 + Math.random() * 3; 
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;

        src.connect(gain);
        gain.connect(pan);
        if (this.delayNode) pan.connect(this.delayNode);
        pan.connect(this.busGain);

        src.start(time);
        src.stop(time + 0.12);
    }

    stop() {
        this.isPlaying = false;
        this.targetVolume = 0.0;

        if (this.ctx && this.masterGain) {
            this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
        }

        if (this.timerID !== null) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }

        if (this.volumeRAF !== null) {
            cancelAnimationFrame(this.volumeRAF);
            this.volumeRAF = null;
        }

        if (this.ctx) {
            const t = this.ctx.currentTime;
            try { this.droneOsc?.stop(t + 0.05); } catch {}
            try { this.droneLFO?.stop(t + 0.05); } catch {}
        }
        this.droneOsc = null;
        this.droneLFO = null;
    }
}

export const audioEngine = new AudioEngine();