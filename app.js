/**
 * BABY POINT - Logique de jeu & Compteur de match au compte à rebours
 * Conforme aux règles officielles et aux ajouts (Tredemi 3 pts, fin au chrono, match nul festif)
 */

(function () {
  'use strict';

  // --- ÉTAT DU JEU ---
  const state = {
    mode: 'solo', // 'solo' ou 'team'
    durationMinutes: 5, // Durée sélectionnée
    totalSeconds: 300,
    remainingSeconds: 300,
    isPaused: false,
    isMatchFinished: false,
    timerInterval: null,
    soundEnabled: true,
    demisRule: 'plus-3', // 'plus-3', 'malus-3', 'bonus-opponent'

    camps: {
      1: {
        name: 'Marin',
        score: 0,
        stats: { pos1: 0, pos2: 0, pos3: 0, pos4: 0, neg1: 0, neg2: 0, tredemi: 0 }
      },
      2: {
        name: 'Paul',
        score: 0,
        stats: { pos1: 0, pos2: 0, pos3: 0, pos4: 0, neg1: 0, neg2: 0, tredemi: 0 }
      }
    },

    undoStack: []
  };

  // --- SÉLECTEURS DU DOM ---
  const dom = {
    arenaMain: document.getElementById('arena-main'),

    // Camp 1
    nameCamp1: document.getElementById('name-camp-1'),
    subCamp1: document.getElementById('sub-camp-1'),
    scoreCamp1: document.getElementById('score-camp-1'),
    negAlert1: document.getElementById('neg-alert-1'),
    shooter1: document.querySelectorAll('.shooter-name-1'),
    opponent1: document.querySelectorAll('.opponent-name-1'),
    btnTredemi1: document.getElementById('btn-tredemi-1'),
    tredemiBadge1: document.getElementById('tredemi-badge-1'),

    // Camp 2
    nameCamp2: document.getElementById('name-camp-2'),
    subCamp2: document.getElementById('sub-camp-2'),
    scoreCamp2: document.getElementById('score-camp-2'),
    negAlert2: document.getElementById('neg-alert-2'),
    shooter2: document.querySelectorAll('.shooter-name-2'),
    opponent2: document.querySelectorAll('.opponent-name-2'),
    btnTredemi2: document.getElementById('btn-tredemi-2'),
    tredemiBadge2: document.getElementById('tredemi-badge-2'),

    // Header & Timer
    matchBadge: document.getElementById('match-badge'),
    timerBadge: document.getElementById('timer-badge'),
    btnPause: document.getElementById('btn-pause'),
    pauseIcon: document.getElementById('pause-icon'),
    pauseText: document.getElementById('pause-text'),
    btnRules: document.getElementById('btn-rules'),
    btnUndo: document.getElementById('btn-undo'),
    btnSound: document.getElementById('btn-sound'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    btnNewMatch: document.getElementById('btn-new-match'),
    btnClearHistory: document.getElementById('btn-clear-history'),

    // Chrono central
    countdownCard: document.getElementById('countdown-card'),
    countdownDisplay: document.getElementById('countdown-display'),
    countdownStatus: document.getElementById('countdown-status'),
    matchStatusBar: document.getElementById('match-status-bar'),
    matchStatusText: document.getElementById('match-status-text'),
    btnResumeStatus: document.getElementById('btn-resume-status'),

    // Historique
    historyList: document.getElementById('history-list'),

    // Modals
    modalSetup: document.getElementById('modal-setup'),
    modalRules: document.getElementById('modal-rules'),
    modalVictory: document.getElementById('modal-victory'),
    
    // Setup form
    setupForm: document.getElementById('setup-form'),
    inputTeam1: document.getElementById('input-team1'),
    inputTeam2: document.getElementById('input-team2'),
    inputCustomMinutes: document.getElementById('input-custom-minutes'),
    selectDemisRule: document.getElementById('select-demis-rule'),
    btnCloseSetup: document.getElementById('btn-close-setup'),

    // Rules modal buttons
    btnCloseRules: document.getElementById('btn-close-rules'),
    btnOkRules: document.getElementById('btn-ok-rules'),

    // Victory modal elements
    victoryCard: document.getElementById('victory-card'),
    victoryIcon: document.getElementById('victory-icon'),
    winnerTitle: document.getElementById('winner-title'),
    winnerScoreSummary: document.getElementById('winner-score-summary'),
    winnerCongrats: document.getElementById('winner-congrats'),
    matchStats: document.getElementById('match-stats'),
    btnRematch: document.getElementById('btn-rematch'),
    btnOvertime: document.getElementById('btn-overtime'),
    btnVictoryMenu: document.getElementById('btn-victory-menu'),
    confettiCanvas: document.getElementById('confetti-canvas')
  };

  // --- SYSTÈME AUDIO SYNTHÉTISÉ (Web Audio API) ---
  const audioCtx = (function() {
    let ctx = null;
    return function() {
      if (!ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) ctx = new AudioContext();
      }
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      return ctx;
    };
  })();

  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      const ctx = audioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'positive') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'negative') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'tredemi') {
        // Son puissant d'éclair / turbo
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        osc.frequency.setValueAtTime(1320, now + 0.16);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'whistle') {
        // 3 coups de sifflet final (court, court, long !)
        const whistleBlasts = [
          { start: 0, duration: 0.18, freq: 2400 },
          { start: 0.28, duration: 0.18, freq: 2400 },
          { start: 0.56, duration: 0.7, freq: 2300 }
        ];
        whistleBlasts.forEach(w => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'square';
          osc.frequency.setValueAtTime(w.freq, now + w.start);
          gain.gain.setValueAtTime(0.25, now + w.start);
          gain.gain.exponentialRampToValueAtTime(0.01, now + w.start + w.duration);
          osc.start(now + w.start);
          osc.stop(now + w.start + w.duration);
        });
      } else if (type === 'victory') {
        // Fanfare triomphale
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.14);
          gain.gain.setValueAtTime(0.28, now + i * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.14 + 0.45);
          osc.start(now + i * 0.14);
          osc.stop(now + i * 0.14 + 0.45);
        });
      } else if (type === 'draw') {
        // Accord festif pour le match nul
        const chord = [440, 554.37, 659.25, 880];
        chord.forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
          osc.start(now);
          osc.stop(now + 1.2);
        });
      } else if (type === 'undo') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch (e) {
      console.warn("Audio non disponible", e);
    }
  }

  // --- COMPTE À REBOURS DU MATCH ---
  function formatTime(seconds) {
    const mins = Math.max(0, Math.floor(seconds / 60));
    const secs = Math.max(0, seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function startCountdown() {
    stopCountdown();
    state.isPaused = false;
    updatePauseButtons();

    state.timerInterval = setInterval(() => {
      if (state.isPaused || state.isMatchFinished) return;

      state.remainingSeconds--;
      renderCountdown();

      // Bip de tension dans les 5 dernières secondes
      if (state.remainingSeconds <= 5 && state.remainingSeconds > 0) {
        playSound('tick');
      }

      // Fin du temps réglementaire !
      if (state.remainingSeconds <= 0) {
        state.remainingSeconds = 0;
        renderCountdown();
        stopCountdown();
        handleTimeUp();
      }
    }, 1000);

    renderCountdown();
  }

  function stopCountdown() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function togglePause() {
    if (state.isMatchFinished) return;
    state.isPaused = !state.isPaused;
    updatePauseButtons();

    if (state.isPaused) {
      dom.countdownCard.classList.add('countdown-paused');
      dom.countdownStatus.textContent = 'En pause';
      dom.matchStatusBar.style.display = 'flex';
      dom.matchStatusText.textContent = '⏸️ Partie en pause';
    } else {
      dom.countdownCard.classList.remove('countdown-paused');
      dom.countdownStatus.textContent = 'En jeu';
      dom.matchStatusBar.style.display = 'none';
    }
  }

  function updatePauseButtons() {
    if (state.isPaused) {
      dom.pauseIcon.textContent = '▶️';
      dom.pauseText.textContent = 'Reprendre';
    } else {
      dom.pauseIcon.textContent = '⏸️';
      dom.pauseText.textContent = 'Pause';
    }
  }

  function renderCountdown() {
    const timeFormatted = formatTime(state.remainingSeconds);
    dom.countdownDisplay.textContent = timeFormatted;
    dom.timerBadge.textContent = `⏱️ Temps : ${timeFormatted}`;

    // Alertes visuelles selon le temps restant
    dom.countdownCard.classList.remove('countdown-warning', 'countdown-danger');
    if (state.remainingSeconds <= 10 && state.remainingSeconds > 0) {
      dom.countdownCard.classList.add('countdown-danger');
    } else if (state.remainingSeconds <= 30 && state.remainingSeconds > 0) {
      dom.countdownCard.classList.add('countdown-warning');
    }
  }

  // --- FIN DU TEMPS RÉGLEMENTAIRE & CÉLÉBRATION ---
  function handleTimeUp(immediate = false) {
    state.isMatchFinished = true;
    dom.arenaMain.classList.add('arena-locked');
    dom.countdownStatus.textContent = 'Temps écoulé !';
    dom.btnUndo.disabled = true;

    playSound('whistle');

    if (immediate) {
      displayFinalCelebration();
    } else {
      setTimeout(() => {
        displayFinalCelebration();
      }, 500);
    }
  }

  function displayFinalCelebration() {
    const s1 = state.camps[1].score;
    const s2 = state.camps[2].score;
    const n1 = state.camps[1].name;
    const n2 = state.camps[2].name;

    dom.modalVictory.style.display = 'flex';
    dom.btnOvertime.style.display = 'none';

    if (s1 > s2) {
      // Victoire Camp 1
      dom.victoryIcon.textContent = '🏆';
      dom.winnerTitle.className = 'victory-title';
      dom.winnerTitle.textContent = `🎉 Victoire de ${n1} !`;
      dom.winnerScoreSummary.textContent = `${n1} : ${s1}  |  ${n2} : ${s2}`;
      dom.winnerCongrats.textContent = `Félicitations à ${n1} qui s'impose au coup de sifflet final !`;
      playSound('victory');
      launchConfetti(['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899']);
    } else if (s2 > s1) {
      // Victoire Camp 2
      dom.victoryIcon.textContent = '🏆';
      dom.winnerTitle.className = 'victory-title';
      dom.winnerTitle.textContent = `🎉 Victoire de ${n2} !`;
      dom.winnerScoreSummary.textContent = `${n2} : ${s2}  |  ${n1} : ${s1}`;
      dom.winnerCongrats.textContent = `Félicitations à ${n2} qui remporte la confrontation !`;
      playSound('victory');
      launchConfetti(['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']);
    } else {
      // MATCH NUL FESTIF
      dom.victoryIcon.textContent = '🤝';
      dom.winnerTitle.className = 'victory-title draw-title';
      dom.winnerTitle.textContent = `🤝 MATCH NUL SPECTACULAIRE !`;
      dom.winnerScoreSummary.textContent = `Égalité parfaite : ${s1} - ${s2}`;
      dom.winnerCongrats.textContent = `Une bataille héroïque entre ${n1} et ${n2} ! Personne n'a cédé !`;
      dom.btnOvertime.style.display = 'inline-flex'; // Option prolongation !
      playSound('draw');
      launchConfetti(['#38bdf8', '#fbbf24', '#f43f5e', '#a855f7', '#ffffff']);
    }

    // Statistiques du match
    renderFinalStats();
  }

  function renderFinalStats() {
    const c1 = state.camps[1];
    const c2 = state.camps[2];

    const totalPos1 = (c1.stats.pos1 || 0) + (c1.stats.pos2 || 0) + (c1.stats.pos3 || 0) + (c1.stats.pos4 || 0);
    const totalPos2 = (c2.stats.pos1 || 0) + (c2.stats.pos2 || 0) + (c2.stats.pos3 || 0) + (c2.stats.pos4 || 0);
    const totalNeg1 = (c1.stats.neg1 || 0) + (c1.stats.neg2 || 0);
    const totalNeg2 = (c2.stats.neg1 || 0) + (c2.stats.neg2 || 0);

    dom.matchStats.innerHTML = `
      <div class="stat-row">
        <span>⏱️ Durée jouée :</span>
        <strong>${state.durationMinutes} minute(s) réglementaires</strong>
      </div>
      <div class="stat-row">
        <span>🟩 Balles positives tirées :</span>
        <span><strong>${c1.name}</strong> : ${totalPos1} | <strong>${c2.name}</strong> : ${totalPos2}</span>
      </div>
      <div class="stat-row">
        <span>🟥 Balles négatives infligées :</span>
        <span><strong>${c1.name}</strong> : ${totalNeg1} | <strong>${c2.name}</strong> : ${totalNeg2}</span>
      </div>
      <div class="stat-row">
        <span>⚡ Tredemis (3 pts) réussis :</span>
        <span><strong>${c1.name}</strong> : ${c1.stats.tredemi || 0} | <strong>${c2.name}</strong> : ${c2.stats.tredemi || 0}</span>
      </div>
    `;
  }

  // Prolongation (+1 minute en mort subite)
  function handleOvertime() {
    stopConfetti();
    dom.modalVictory.style.display = 'none';
    dom.arenaMain.classList.remove('arena-locked');
    state.isMatchFinished = false;
    state.remainingSeconds = 60; // 1 minute de prolongation
    startCountdown();
    updateUI();

    addHistoryEntry({
      team: 1,
      time: new Date().toLocaleTimeString(),
      text: `🔥 <strong>PROLONGATION !</strong> 1 minute supplémentaire accordée !`,
      badgeClass: 'badge-tredemi',
      badgeVal: '+1 min'
    });
  }

  // --- MISE À JOUR DE L'AFFICHAGE ---
  function updateUI() {
    dom.nameCamp1.textContent = state.camps[1].name;
    dom.nameCamp2.textContent = state.camps[2].name;

    dom.shooter1.forEach(el => el.textContent = state.camps[1].name);
    dom.opponent1.forEach(el => el.textContent = state.camps[2].name);
    dom.shooter2.forEach(el => el.textContent = state.camps[2].name);
    dom.opponent2.forEach(el => el.textContent = state.camps[1].name);

    if (state.mode === 'team') {
      dom.subCamp1.textContent = 'Équipe 1';
      dom.subCamp2.textContent = 'Équipe 2';
      dom.matchBadge.textContent = 'Mode Équipe';
    } else {
      dom.subCamp1.textContent = 'Camp 1';
      dom.subCamp2.textContent = 'Camp 2';
      dom.matchBadge.textContent = '1 vs 1 (Solo)';
    }

    // Badge Tredemi texte selon règle
    const badgeText = state.demisRule === 'malus-3' ? '-3 pts' : '+3 pts';
    dom.tredemiBadge1.textContent = badgeText;
    dom.tredemiBadge2.textContent = badgeText;

    renderScore(1);
    renderScore(2);

    dom.btnUndo.disabled = state.undoStack.length === 0 || state.isMatchFinished;
    dom.btnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
  }

  function renderScore(teamId) {
    const scoreEl = teamId === 1 ? dom.scoreCamp1 : dom.scoreCamp2;
    const alertEl = teamId === 1 ? dom.negAlert1 : dom.negAlert2;
    const score = state.camps[teamId].score;

    scoreEl.textContent = score;

    if (score < 0) {
      scoreEl.classList.add('is-negative');
      alertEl.style.display = 'block';
      alertEl.textContent = `⚠️ En négatif : « ${score === -1 ? 'Moins un point' : score + ' points'} »`;
    } else {
      scoreEl.classList.remove('is-negative');
      alertEl.style.display = 'none';
    }
  }

  function triggerScorePulse(teamId) {
    const scoreEl = teamId === 1 ? dom.scoreCamp1 : dom.scoreCamp2;
    scoreEl.classList.add('pulse');
    setTimeout(() => {
      scoreEl.classList.remove('pulse');
    }, 180);
  }

  // --- ACTIONS DE JEU ---
  function handleBallShoot(shooterTeamId, type, value) {
    if (state.isMatchFinished || state.isPaused) return;

    const opponentTeamId = shooterTeamId === 1 ? 2 : 1;
    const shooter = state.camps[shooterTeamId];
    const opponent = state.camps[opponentTeamId];

    const previousState = {
      camps: JSON.parse(JSON.stringify(state.camps)),
      historyItem: null
    };

    let logText = '';
    let badgeClass = '';
    let badgeVal = '';

    if (type === 'positive') {
      shooter.score += value;
      shooter.stats['pos' + value] = (shooter.stats['pos' + value] || 0) + 1;
      triggerScorePulse(shooterTeamId);
      playSound('positive');

      logText = `<strong>${shooter.name}</strong> marque une balle <strong>+${value}</strong> (+${value} pts)`;
      badgeClass = 'badge-pos';
      badgeVal = `+${value}`;
    } else if (type === 'negative') {
      const pts = Math.abs(value);
      opponent.score -= pts;
      shooter.stats['neg' + pts] = (shooter.stats['neg' + pts] || 0) + 1;
      triggerScorePulse(opponentTeamId);
      playSound('negative');

      logText = `<strong>${shooter.name}</strong> loge une balle <strong>-${pts}</strong> (-${pts} pt pour <em>${opponent.name}</em>)`;
      badgeClass = 'badge-neg';
      badgeVal = `-${pts}`;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const historyItem = { team: shooterTeamId, time: timeStr, text: logText, badgeClass, badgeVal };

    previousState.historyItem = historyItem;
    state.undoStack.push(previousState);

    addHistoryEntry(historyItem);
    updateUI();
  }

  // ACTION SPÉCIALE : TREDEMI (3 POINTS)
  function handleTredemi(shooterTeamId) {
    if (state.isMatchFinished || state.isPaused) return;

    const opponentTeamId = shooterTeamId === 1 ? 2 : 1;
    const shooter = state.camps[shooterTeamId];
    const opponent = state.camps[opponentTeamId];

    const previousState = {
      camps: JSON.parse(JSON.stringify(state.camps)),
      historyItem: null
    };

    shooter.stats.tredemi = (shooter.stats.tredemi || 0) + 1;
    playSound('tredemi');

    let logText = '';
    let badgeVal = '+3 Tredemi';

    if (state.demisRule === 'plus-3') {
      shooter.score += 3;
      triggerScorePulse(shooterTeamId);
      logText = `⚡ <strong>TREDEMI !</strong> Tir des demis magistral de <strong>${shooter.name}</strong> : <strong>+3 points</strong> !`;
      badgeVal = '+3 pts';
    } else if (state.demisRule === 'malus-3') {
      shooter.score -= 3;
      triggerScorePulse(shooterTeamId);
      logText = `⚡ <strong>Tredemi (faute) !</strong> ${shooter.name} tire avec les demis : pénalité de <strong>-3 points</strong>`;
      badgeVal = '-3 pts';
    } else if (state.demisRule === 'bonus-opponent') {
      opponent.score += 3;
      triggerScorePulse(opponentTeamId);
      logText = `⚡ <strong>Tredemi !</strong> Tir des demis par ${shooter.name} : <strong>+3 points offerts à ${opponent.name}</strong> !`;
      badgeVal = '+3 adv.';
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const historyItem = { team: shooterTeamId, time: timeStr, text: logText, badgeClass: 'badge-tredemi', badgeVal };

    previousState.historyItem = historyItem;
    state.undoStack.push(previousState);

    addHistoryEntry(historyItem);
    updateUI();
  }

  // Ajustement manuel (+1 / -1 direct)
  function handleManualAdjust(teamId, val) {
    if (state.isMatchFinished || state.isPaused) return;

    const previousState = {
      camps: JSON.parse(JSON.stringify(state.camps)),
      historyItem: null
    };

    state.camps[teamId].score += val;
    triggerScorePulse(teamId);
    playSound(val > 0 ? 'positive' : 'negative');

    const historyItem = {
      team: teamId,
      time: new Date().toLocaleTimeString(),
      text: `Correction manuelle pour <strong>${state.camps[teamId].name}</strong> (${val > 0 ? '+' + val : val} pt)`,
      badgeClass: val > 0 ? 'badge-pos' : 'badge-neg',
      badgeVal: val > 0 ? `+${val}` : `${val}`
    };

    previousState.historyItem = historyItem;
    state.undoStack.push(previousState);

    addHistoryEntry(historyItem);
    updateUI();
  }

  // --- HISTORIQUE & ANNULATION ---
  function addHistoryEntry(item) {
    const emptyMsg = dom.historyList.querySelector('.history-empty');
    if (emptyMsg) emptyMsg.remove();

    const row = document.createElement('div');
    row.className = `history-item team-${item.team}`;
    row.innerHTML = `
      <span class="history-time">${item.time}</span>
      <span class="history-desc">${item.text}</span>
      <span class="history-badge ${item.badgeClass}">${item.badgeVal}</span>
    `;

    dom.historyList.insertBefore(row, dom.historyList.firstChild);
  }

  function undoLastAction() {
    if (state.undoStack.length === 0 || state.isMatchFinished) return;
    const last = state.undoStack.pop();
    state.camps = last.camps;
    playSound('undo');

    if (dom.historyList.firstChild && !dom.historyList.firstChild.classList.contains('history-empty')) {
      dom.historyList.firstChild.remove();
      if (dom.historyList.children.length === 0) {
        dom.historyList.innerHTML = `<div class="history-empty">Coup annulé. En attente du tir !</div>`;
      }
    }

    updateUI();
  }

  // --- CONFETTIS SPECTACULAIRES (Canvas) ---
  let confettiAnimId = null;
  function launchConfetti(customColors) {
    const canvas = dom.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = customColors || ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

    for (let i = 0; i < 150; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 10 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        velY: Math.random() * 5 + 2.5,
        velX: (Math.random() - 0.5) * 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.velY;
        p.x += p.velX;
        p.rotation += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        ctx.restore();

        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
      });

      confettiAnimId = requestAnimationFrame(render);
    }

    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
    render();
  }

  function stopConfetti() {
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }
    const canvas = dom.confettiCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // --- INITIALISATION & ÉVÉNEMENTS ---
  function initEvents() {
    // Boutons de balles (+1, +2, +3, +4, -1, -2)
    document.querySelectorAll('.btn-ball').forEach(btn => {
      btn.addEventListener('click', () => {
        const team = parseInt(btn.getAttribute('data-team'), 10);
        const type = btn.getAttribute('data-type');
        const value = parseInt(btn.getAttribute('data-value'), 10);
        handleBallShoot(team, type, value);
      });
    });

    // Boutons Tredemi (3 points)
    dom.btnTredemi1.addEventListener('click', () => handleTredemi(1));
    dom.btnTredemi2.addEventListener('click', () => handleTredemi(2));

    // Ajustements manuels (+ / -)
    document.querySelectorAll('.btn-mini').forEach(btn => {
      btn.addEventListener('click', () => {
        const team = parseInt(btn.getAttribute('data-team'), 10);
        const val = parseInt(btn.getAttribute('data-val'), 10);
        handleManualAdjust(team, val);
      });
    });

    // Pause / Reprendre
    dom.btnPause.addEventListener('click', togglePause);
    dom.btnResumeStatus.addEventListener('click', togglePause);

    // Édition directe des noms
    [dom.nameCamp1, dom.nameCamp2].forEach((el, index) => {
      el.addEventListener('blur', () => {
        const teamId = index + 1;
        const newName = el.textContent.trim();
        if (newName) {
          state.camps[teamId].name = newName;
          updateUI();
        } else {
          el.textContent = state.camps[teamId].name;
        }
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          el.blur();
        }
      });
    });

    // Annuler
    dom.btnUndo.addEventListener('click', undoLastAction);
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoLastAction();
      } else if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePause();
      }
    });

    // Toggle Son
    dom.btnSound.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      dom.btnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
    });

    // Plein écran
    dom.btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });

    // Effacer historique
    dom.btnClearHistory.addEventListener('click', () => {
      dom.historyList.innerHTML = `<div class="history-empty">Journal réinitialisé.</div>`;
    });

    // Mode Toggle (Solo vs Équipe)
    document.querySelectorAll('.btn-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        if (mode === 'team') {
          dom.inputTeam1.value = 'Équipe Bleue';
          dom.inputTeam2.value = 'Équipe Rouge';
        } else {
          dom.inputTeam1.value = 'Marin';
          dom.inputTeam2.value = 'Paul';
        }
      });
    });

    // Préréglages de durée (1, 3, 5, 10 min)
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mins = parseInt(btn.getAttribute('data-minutes'), 10);
        dom.inputCustomMinutes.value = mins;
      });
    });

    dom.inputCustomMinutes.addEventListener('input', () => {
      const val = parseInt(dom.inputCustomMinutes.value, 10);
      document.querySelectorAll('.btn-preset').forEach(b => {
        if (parseInt(b.getAttribute('data-minutes'), 10) === val) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    });

    // Lancer la partie (Formulaire)
    dom.setupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeModeBtn = document.querySelector('.btn-mode.active');
      state.mode = activeModeBtn ? activeModeBtn.getAttribute('data-mode') : 'solo';
      
      state.camps[1].name = dom.inputTeam1.value.trim() || 'Marin';
      state.camps[2].name = dom.inputTeam2.value.trim() || 'Paul';

      const minutes = parseInt(dom.inputCustomMinutes.value, 10) || 5;
      state.durationMinutes = minutes;
      state.totalSeconds = minutes * 60;
      state.remainingSeconds = state.totalSeconds;

      state.demisRule = dom.selectDemisRule.value;

      resetMatchData();
      dom.modalSetup.style.display = 'none';
      dom.arenaMain.classList.remove('arena-locked');
      startCountdown();
      updateUI();
    });

    // Modale Menu / Nouvelle Partie
    dom.btnNewMatch.addEventListener('click', () => {
      dom.modalSetup.style.display = 'flex';
    });
    dom.btnCloseSetup.addEventListener('click', () => {
      dom.modalSetup.style.display = 'none';
    });

    // Notice des Règles
    dom.btnRules.addEventListener('click', () => {
      dom.modalRules.style.display = 'flex';
    });
    dom.btnCloseRules.addEventListener('click', () => {
      dom.modalRules.style.display = 'none';
    });
    dom.btnOkRules.addEventListener('click', () => {
      dom.modalRules.style.display = 'none';
    });

    // Boutons de fin de partie
    dom.btnRematch.addEventListener('click', () => {
      stopConfetti();
      dom.modalVictory.style.display = 'none';
      dom.arenaMain.classList.remove('arena-locked');
      state.remainingSeconds = state.totalSeconds;
      resetMatchData();
      startCountdown();
      updateUI();
    });

    dom.btnOvertime.addEventListener('click', handleOvertime);

    dom.btnVictoryMenu.addEventListener('click', () => {
      stopConfetti();
      dom.modalVictory.style.display = 'none';
      dom.modalSetup.style.display = 'flex';
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dom.modalSetup.style.display = 'none';
        dom.modalRules.style.display = 'none';
        dom.modalVictory.style.display = 'none';
        stopConfetti();
      }
    });
  }

  function resetMatchData() {
    state.isMatchFinished = false;
    state.isPaused = false;
    dom.arenaMain.classList.remove('arena-locked');
    dom.matchStatusBar.style.display = 'none';
    dom.countdownCard.classList.remove('countdown-paused', 'countdown-warning', 'countdown-danger');
    dom.countdownStatus.textContent = 'En jeu';
    updatePauseButtons();

    state.camps[1].score = 0;
    state.camps[2].score = 0;
    state.camps[1].stats = { pos1: 0, pos2: 0, pos3: 0, pos4: 0, neg1: 0, neg2: 0, tredemi: 0 };
    state.camps[2].stats = { pos1: 0, pos2: 0, pos3: 0, pos4: 0, neg1: 0, neg2: 0, tredemi: 0 };
    state.undoStack = [];
    dom.historyList.innerHTML = `<div class="history-empty">Nouvelle partie démarrée au coup d'envoi !</div>`;
  }

  // --- DÉMARRAGE ---
  function init() {
    initEvents();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('draw')) {
      dom.modalSetup.style.display = 'none';
      state.camps[1].score = 6;
      state.camps[2].score = 6;
      updateUI();
      handleTimeUp(true);
    } else if (urlParams.has('victory')) {
      dom.modalSetup.style.display = 'none';
      state.camps[1].score = 9;
      state.camps[2].score = 5;
      updateUI();
      handleTimeUp(true);
    } else if (urlParams.has('direct') || urlParams.has('start')) {
      dom.modalSetup.style.display = 'none';
      startCountdown();
    } else {
      dom.modalSetup.style.display = 'flex';
    }
    updateUI();
    renderCountdown();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
