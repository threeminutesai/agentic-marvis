function createMusicPanel({ musicController } = {}) {
  let catalog = { tracks: [], playlists: [], schedule: {} };
  let activeScheduleDay = 'monday';
  let previewAudio = null;
  let previewingTrackId = null;
  let backgroundWasPlayingBeforePreview = false;

  function getCurrentLanguage() {
    return window.__marvisLanguage === 'zh' ? 'zh' : 'en';
  }

  function t(en, zh) {
    return getCurrentLanguage() === 'zh' ? zh : en;
  }

  function stopPreview() {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }
    previewingTrackId = null;
    if (backgroundWasPlayingBeforePreview && musicController) {
      musicController.resume();
    }
    backgroundWasPlayingBeforePreview = false;
  }

  function playPreview(track, button) {
    stopPreview();
    if (!track.fileUrl) return;
    const nowPlaying = musicController?.getNowPlaying?.();
    backgroundWasPlayingBeforePreview = Boolean(nowPlaying && !nowPlaying.isPaused);
    if (backgroundWasPlayingBeforePreview && musicController) {
      musicController.pause();
    }
    const volumeInput = document.getElementById('music-volume-input');
    const volume = volumeInput ? parseFloat(volumeInput.value) : 1;
    const audio = new Audio(track.fileUrl);
    audio.volume = Number.isFinite(volume) ? volume : 1;
    // Route through the same loudness leveler scheduled playback uses, so
    // the preview accurately reflects what the user will actually hear.
    if (musicController?.applyLeveling) musicController.applyLeveling(audio);
    audio.addEventListener('ended', () => {
      if (previewingTrackId === track.id) stopPreview();
      if (button) button.textContent = t('Play', '播放');
    });
    audio.play().catch(() => {
      if (previewingTrackId === track.id) stopPreview();
      if (button) button.textContent = t('Play', '播放');
    });
    previewAudio = audio;
    previewingTrackId = track.id;
  }

  function getDayLabels() {
    return getCurrentLanguage() === 'zh'
      ? {
          sunday: '周日', monday: '周一', tuesday: '周二', wednesday: '周三',
          thursday: '周四', friday: '周五', saturday: '周六',
        }
      : {
          sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
          thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
        };
  }

  function getBucketLabels() {
    return getCurrentLanguage() === 'zh'
      ? {
          earlyMorning: '清晨 (5-8am)',
          morning: '上午 (8am-12pm)',
          afternoon: '下午 (12-5pm)',
          evening: '晚上 (5-9pm)',
          midnight: '深夜 (9pm-5am)',
        }
      : {
          earlyMorning: 'Early Morning (5-8am)',
          morning: 'Morning (8am-12pm)',
          afternoon: 'Afternoon (12-5pm)',
          evening: 'Evening (5-9pm)',
          midnight: 'Midnight (9pm-5am)',
        };
  }
  const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const BUCKET_ORDER = ['earlyMorning', 'morning', 'afternoon', 'evening', 'midnight'];

  async function load() {
    catalog = await window.marvis.getMusicLibrary();
    renderAll();
    return catalog;
  }

  async function persist() {
    await window.marvis.saveMusicLibrary(catalog);
    if (musicController) musicController.setCatalog(catalog);
  }

  function renderAll() {
    renderLibraryTab();
    renderPlaylistsTab();
    renderScheduleTab();
  }

  function renderLibraryTab() {
    const list = document.getElementById('music-track-list');
    if (!list) return;
    list.innerHTML = '';
    for (const track of catalog.tracks) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = track.originalName || track.id || 'Unknown Track';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = t('Delete', '删除');
      removeBtn.addEventListener('click', async () => {
        const result = await window.marvis.deleteMusicTrack(track.id);
        if (result.ok) {
          catalog = result.catalog;
          if (musicController) musicController.setCatalog(catalog);
          renderAll();
        }
      });
      li.append(name, removeBtn);
      list.appendChild(li);
    }
  }

  function renderPlaylistsTab() {
    const select = document.getElementById('music-playlist-select');
    if (!select) return;
    const previousValue = select.value;
    select.innerHTML = '';
    for (const playlist of catalog.playlists) {
      const option = document.createElement('option');
      option.value = playlist.id;
      option.textContent = playlist.name;
      select.appendChild(option);
    }
    select.value = catalog.playlists.some((p) => p.id === previousValue)
      ? previousValue
      : (catalog.playlists[0]?.id || '');
    renderPlaylistTrackChecklist();
  }

  function renderPlaylistTrackChecklist() {
    const checklist = document.getElementById('music-playlist-track-checklist');
    const select = document.getElementById('music-playlist-select');
    if (!checklist || !select) return;
    stopPreview();
    const playlist = catalog.playlists.find((p) => p.id === select.value) || null;
    checklist.innerHTML = '';
    for (const track of catalog.tracks) {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!playlist && playlist.trackIds.includes(track.id);
      checkbox.disabled = !playlist;
      checkbox.addEventListener('change', async () => {
        if (!playlist) return;
        if (checkbox.checked) {
          playlist.trackIds.push(track.id);
        } else {
          playlist.trackIds = playlist.trackIds.filter((id) => id !== track.id);
        }
        await persist();
      });
      label.append(checkbox, document.createTextNode(' ' + (track.originalName || track.id || 'Unknown Track')));
      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.textContent = t('Play', '播放');
      playBtn.addEventListener('click', () => {
        if (previewingTrackId === track.id) {
          stopPreview();
          playBtn.textContent = t('Play', '播放');
        } else {
          document.querySelectorAll('#music-playlist-track-checklist button.previewing').forEach((b) => {
            b.textContent = t('Play', '播放');
            b.classList.remove('previewing');
          });
          playPreview(track, playBtn);
          playBtn.textContent = t('Stop', '停止');
          playBtn.classList.add('previewing');
        }
      });
      li.append(label, playBtn);
      checklist.appendChild(li);
    }
  }

  function renderScheduleTab() {
    const dayTabsEl = document.getElementById('music-schedule-day-tabs');
    const rowsEl = document.getElementById('music-schedule-rows');
    if (!dayTabsEl || !rowsEl) return;
    const DAY_LABELS = getDayLabels();
    const BUCKET_LABELS = getBucketLabels();

    dayTabsEl.innerHTML = '';
    for (const day of DAY_ORDER) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'music-schedule-day-tab' + (day === activeScheduleDay ? ' active' : '');
      btn.textContent = DAY_LABELS[day];
      btn.addEventListener('click', () => {
        activeScheduleDay = day;
        renderScheduleTab();
      });
      dayTabsEl.appendChild(btn);
    }

    rowsEl.innerHTML = '';
    for (const bucketKey of BUCKET_ORDER) {
      const row = document.createElement('div');
      row.className = 'music-schedule-row';
      const label = document.createElement('span');
      label.textContent = BUCKET_LABELS[bucketKey];
      const select = document.createElement('select');
      const noneOption = document.createElement('option');
      noneOption.value = '';
      noneOption.textContent = '—';
      select.appendChild(noneOption);
      for (const playlist of catalog.playlists) {
        const option = document.createElement('option');
        option.value = playlist.id;
        option.textContent = playlist.name;
        select.appendChild(option);
      }
      select.value = catalog.schedule?.[activeScheduleDay]?.[bucketKey] || '';
      select.addEventListener('change', async () => {
        if (!catalog.schedule[activeScheduleDay]) catalog.schedule[activeScheduleDay] = {};
        catalog.schedule[activeScheduleDay][bucketKey] = select.value || null;
        await persist();
      });
      row.append(label, select);
      rowsEl.appendChild(row);
    }
  }

  document.getElementById('music-toggle-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('music-panel');
    const isHidden = panel?.classList.toggle('hidden');
    if (isHidden) stopPreview();
  });

  document.querySelectorAll('.music-tab').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.music-tab').forEach((b) => b.classList.toggle('active', b === button));
      const tab = button.dataset.musicTab;
      document.getElementById('music-library-tab')?.classList.toggle('hidden', tab !== 'library');
      document.getElementById('music-playlists-tab')?.classList.toggle('hidden', tab !== 'playlists');
      document.getElementById('music-schedule-tab')?.classList.toggle('hidden', tab !== 'schedule');
    });
  });

  document.getElementById('music-import-btn')?.addEventListener('click', async () => {
    const result = await window.marvis.importMusicFiles();
    if (result.ok) {
      catalog = result.catalog;
      if (musicController) musicController.setCatalog(catalog);
      renderAll();
    }
  });

  document.getElementById('music-playlist-create-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('music-playlist-name-input');
    const name = input.value.trim();
    if (!name) return;
    const id = `pl_${Math.random().toString(36).slice(2, 8)}`;
    catalog.playlists.push({ id, name, trackIds: [] });
    input.value = '';
    await persist();
    renderAll();
  });

  document.getElementById('music-playlist-delete-btn')?.addEventListener('click', async () => {
    const select = document.getElementById('music-playlist-select');
    if (!select.value) return;
    catalog = removePlaylistFromCatalog(catalog, select.value);
    await persist();
    renderAll();
  });

  document.getElementById('music-playlist-select')?.addEventListener('change', renderPlaylistTrackChecklist);

  return { load };
}

if (typeof module !== 'undefined') module.exports = { createMusicPanel };
