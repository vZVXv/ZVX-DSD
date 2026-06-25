// ==UserScript==
// @name         ZVX - Deep Sleep Dimmer
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Виджет затемнения сайтов.
// @author       ZVX
// @match        *://*/*
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue

// ==/UserScript==

// Комментарий: @noframes запрещает работу скрипта внутри фреймов (iframe)

(function() {
    'use strict';

    // ДОБАВЛЕНО: Предохранитель на уровне JS.
    // Если мы внутри iframe (плеер, чат и т.д.), останавливаем выполнение.
    if (window !== window.top) return;

    // 1. Создаем слой затемнения
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
// ... (дальше идет весь ваш оригинальный код без изменений) ...
        height: '100vh',
        backgroundColor: 'black',
        opacity: '0',
        zIndex: '2147483645',
        pointerEvents: 'none',
        transition: 'opacity 0.1s ease-out'
    });
    document.documentElement.appendChild(overlay);

    // 2. Главный контейнер виджета
    const widget = document.createElement('div');
    Object.assign(widget.style, {
        position: 'fixed',
        zIndex: '2147483646',
        display: 'flex',
        alignItems: 'center',
        opacity: '0.75', // Базовая прозрачность
        // ИСПОЛЬЗУЕМ DROP-SHADOW вместо BOX-SHADOW, чтобы тень облегала только элементы, а не пустой прозрачный контейнер
        filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
        transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    });

    // Эффект появления при наведении
    widget.addEventListener('mouseenter', () => {
        if (!isWidgetHidden) widget.style.opacity = '1';
    });
    widget.addEventListener('mouseleave', () => {
        if (!isWidgetHidden) widget.style.opacity = '0.75';
    });

    // --- СОЗДАЕМ КАСТОМНУЮ ПОДСКАЗКУ (ТУЛТИП) ---
    const tooltip = document.createElement('div');
    Object.assign(tooltip.style, {
        position: 'fixed',
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: '2147483647',
        whiteSpace: 'pre-line',
        opacity: '0',
        visibility: 'hidden',
        transition: 'opacity 0.15s ease, visibility 0.15s ease',
        border: '1px solid #444'
    });

    function showTooltip(e, text) {
        tooltip.innerText = text;
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
        moveTooltip(e);
    }

    function moveTooltip(e) {
        let x = e.clientX + 15;
        let y = e.clientY + 15;

        // Чтобы подсказка не уходила за края экрана
        const rect = tooltip.getBoundingClientRect();
        if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 15;
        if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 15;

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    function hideTooltip() {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    }

    // 3. Кнопка-луна (ручка для перетаскивания и переключатель)
    const toggleBtn = document.createElement('button');
    toggleBtn.innerText = '🌙';
    Object.assign(toggleBtn.style, {
        width: '46px',
        height: '46px',
        background: 'rgba(30, 30, 30, 0.95)',
        fontSize: '22px',
        cursor: 'grab',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0',
        outline: 'none',
        border: 'none',
        transition: 'background 0.2s, border-radius 0.2s',
        userSelect: 'none',
        flexShrink: '0',
        boxSizing: 'border-box'
    });

    toggleBtn.addEventListener('mouseenter', (e) => {
        if (!isDragging) showTooltip(e, 'Зажми для переноса / Клик для настроек');
        toggleBtn.style.background = 'rgba(50, 50, 50, 0.95)';
    });
    toggleBtn.addEventListener('mousemove', (e) => {
        if (!isDragging) moveTooltip(e);
    });
    toggleBtn.addEventListener('mouseleave', () => {
        hideTooltip();
        toggleBtn.style.background = 'rgba(30, 30, 30, 0.95)';
    });
    widget.appendChild(toggleBtn);

    // 4. Панель управления
    const controlPanel = document.createElement('div');
    Object.assign(controlPanel.style, {
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        padding: '15px 10px',
        alignItems: 'center',
        gap: '12px',
        color: '#eee',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        transition: 'border-radius 0.2s'
    });
    widget.appendChild(controlPanel);

    // 5. Иконка сверху (Темно)
    const labelTop = document.createElement('div');
    labelTop.innerText = '🌒';
    labelTop.style.fontSize = '18px';
    controlPanel.appendChild(labelTop);

    // 6. Ползунок
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '0.95';
    slider.step = '0.05';
    slider.value = '0';
    Object.assign(slider.style, {
        cursor: 'pointer',
        appearance: 'slider-vertical',
        WebkitAppearance: 'slider-vertical',
        writingMode: 'bt-lr',
        width: '8px',
        height: '110px',
        margin: '0',
        outline: 'none'
    });
    controlPanel.appendChild(slider);

    // 6.5 Иконка снизу (Светло)
    const labelBottom = document.createElement('div');
    labelBottom.innerText = '🌕';
    labelBottom.style.fontSize = '18px';
    controlPanel.appendChild(labelBottom);

    // 7. Кнопка 100% темноты
    const blackoutBtn = document.createElement('button');
    blackoutBtn.innerText = '🌑';
    Object.assign(blackoutBtn.style, {
        background: 'none',
        border: 'none',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '5px',
        outline: 'none',
        transition: 'transform 0.1s ease',
        color: '#fff'
    });

    blackoutBtn.addEventListener('mouseenter', (e) => {
        showTooltip(e, 'Режим 100% темноты.\nКурсор и эта панель скроются.\nСлучайные нажатия отключатся.\nВернуть всё назад можно нажав клавишу Esc (пару раз).');
        blackoutBtn.style.transform = 'scale(1.2)';
    });
    blackoutBtn.addEventListener('mousemove', moveTooltip);
    blackoutBtn.addEventListener('mouseleave', () => {
        hideTooltip();
        blackoutBtn.style.transform = 'scale(1)';
    });
    controlPanel.appendChild(blackoutBtn);

    document.documentElement.appendChild(widget);
    document.documentElement.appendChild(tooltip);

    // --- СОСТОЯНИЯ, ЛОГИКА И ПАМЯТЬ ---

    let dockSide = GM_getValue('ZVX_dockSide', 'right');
    widget.style.top = GM_getValue('ZVX_top', '40%');
    widget.style.left = GM_getValue('ZVX_left', 'auto');

    let isDragging = false;
    let isMoved = false;
    let isMenuOpen = false;
    let isFullBlackout = false;
    let isWidgetHidden = false;
    let hideTimeoutId = null;

    let startX, startY, initialLeft, initialTop;

    function startHideTimer() {
        clearHideTimer();
        hideTimeoutId = setTimeout(() => {
            if (isFullBlackout) {
                isWidgetHidden = true;
                isMenuOpen = false;
                applyStyles();
            }
        }, 20000);
    }

    function clearHideTimer() {
        if (hideTimeoutId) {
            clearTimeout(hideTimeoutId);
            hideTimeoutId = null;
        }
    }

    function applyStyles() {
        widget.style.opacity = isWidgetHidden ? '0' : '0.75';
        widget.style.pointerEvents = isWidgetHidden ? 'none' : 'auto';

        // Восстанавливаем индивидуальные скругления углов для нужных граней
        if (dockSide === 'right') {
            Object.assign(widget.style, { flexDirection: 'row', left: 'auto', right: '0' });
            Object.assign(toggleBtn.style, { borderRadius: '12px 0 0 12px' });
            Object.assign(controlPanel.style, { display: 'flex', borderRadius: '12px 0 0 12px', marginTop: '0', flexDirection: 'column' });
            widget.style.transform = isWidgetHidden ? 'translateX(100%)' : (isMenuOpen ? 'translateX(0)' : 'translateX(calc(100% - 46px))');

        } else if (dockSide === 'left') {
            Object.assign(widget.style, { flexDirection: 'row-reverse', right: 'auto', left: '0' });
            Object.assign(toggleBtn.style, { borderRadius: '0 12px 12px 0' });
            Object.assign(controlPanel.style, { display: 'flex', borderRadius: '0 12px 12px 0', marginTop: '0', flexDirection: 'column' });
            widget.style.transform = isWidgetHidden ? 'translateX(-100%)' : (isMenuOpen ? 'translateX(0)' : 'translateX(calc(-100% + 46px))');

        } else if (dockSide === 'top') {
            Object.assign(widget.style, { flexDirection: 'column-reverse', top: '0' });
            Object.assign(toggleBtn.style, { borderRadius: '0 0 12px 12px' });
            Object.assign(controlPanel.style, { display: 'flex', borderRadius: '0 0 12px 12px', marginTop: '0', flexDirection: 'column' });
            widget.style.transform = isWidgetHidden ? 'translateY(-100%)' : (isMenuOpen ? 'translateY(0)' : 'translateY(calc(-100% + 46px))');

        } else { // Свободное положение ('none')
            Object.assign(widget.style, { flexDirection: 'column', right: 'auto', transform: isWidgetHidden ? 'scale(0)' : 'none' });
            Object.assign(toggleBtn.style, { borderRadius: '50%' });
            Object.assign(controlPanel.style, { display: isMenuOpen ? 'flex' : 'none', borderRadius: '12px', marginTop: '10px', flexDirection: 'column' });
        }
    }

    applyStyles();

    // --- ОБРАБОТКА ДВИЖЕНИЯ МЫШИ ---
    toggleBtn.addEventListener('mousedown', (e) => {
        if (isWidgetHidden) return;

        hideTooltip();
        isDragging = true;
        isMoved = false;

        const rect = widget.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        startX = e.clientX;
        startY = e.clientY;

        widget.style.transition = 'none';
        toggleBtn.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            isMoved = true;
        }

        if (isMoved) {
            const distRight = window.innerWidth - e.clientX;
            const distLeft = e.clientX;
            const distTop = e.clientY;

            if (dockSide === 'none') {
                if (distRight < 60) {
                    dockSide = 'right'; isMenuOpen = false;
                    widget.style.left = 'auto'; startY = e.clientY; initialTop = widget.getBoundingClientRect().top;
                } else if (distLeft < 60) {
                    dockSide = 'left'; isMenuOpen = false;
                    widget.style.right = 'auto'; startY = e.clientY; initialTop = widget.getBoundingClientRect().top;
                } else if (distTop < 60) {
                    dockSide = 'top'; isMenuOpen = false;
                    startX = e.clientX; initialLeft = widget.getBoundingClientRect().left;
                }
            } else {
                if (dockSide === 'right' && distRight > 100) {
                    dockSide = 'none'; widget.style.right = 'auto';
                    widget.style.left = (e.clientX - 23) + 'px';
                    startX = e.clientX; startY = e.clientY; initialLeft = e.clientX - 23; initialTop = widget.getBoundingClientRect().top;
                } else if (dockSide === 'left' && distLeft > 100) {
                    dockSide = 'none'; widget.style.left = (e.clientX - 23) + 'px';
                    startX = e.clientX; startY = e.clientY; initialLeft = e.clientX - 23; initialTop = widget.getBoundingClientRect().top;
                } else if (dockSide === 'top' && distTop > 100) {
                    dockSide = 'none'; widget.style.top = (e.clientY - 23) + 'px';
                    startX = e.clientX; startY = e.clientY; initialTop = e.clientY - 23; initialLeft = widget.getBoundingClientRect().left;
                }
            }

            if (dockSide === 'right' || dockSide === 'left') {
                let newTop = initialTop + (e.clientY - startY);
                widget.style.top = Math.max(0, Math.min(newTop, window.innerHeight - 46)) + 'px';
            } else if (dockSide === 'top') {
                let newLeft = initialLeft + (e.clientX - startX);
                widget.style.left = Math.max(0, Math.min(newLeft, window.innerWidth - 46)) + 'px';
            } else {
                let newLeft = initialLeft + (e.clientX - startX);
                let newTop = initialTop + (e.clientY - startY);
                widget.style.left = Math.max(0, Math.min(newLeft, window.innerWidth - 46)) + 'px';
                widget.style.top = Math.max(0, Math.min(newTop, window.innerHeight - (isMenuOpen ? widget.offsetHeight : 46))) + 'px';
            }

            applyStyles();
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        toggleBtn.style.cursor = 'grab';
        widget.style.transition = 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        applyStyles();

        GM_setValue('ZVX_dockSide', dockSide);
        GM_setValue('ZVX_top', widget.style.top);
        GM_setValue('ZVX_left', widget.style.left);
    });

    // --- КЛИКИ И ФУНКЦИОНАЛ ---
    toggleBtn.addEventListener('click', () => {
        if (!isMoved) {
            isMenuOpen = !isMenuOpen;
            applyStyles();
            if (isFullBlackout) startHideTimer();
        }
    });

    slider.addEventListener('input', function() {
        overlay.style.opacity = this.value;
        if (isFullBlackout) {
            isFullBlackout = false;
            overlay.style.pointerEvents = 'none';
            overlay.style.cursor = 'default';
            clearHideTimer();
            isWidgetHidden = false;
            applyStyles();
        }
    });

    blackoutBtn.addEventListener('click', () => {
        hideTooltip();
        isFullBlackout = !isFullBlackout;
        if (isFullBlackout) {
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
            overlay.style.cursor = 'none';
            isMenuOpen = false;
            applyStyles();
            startHideTimer();
        } else {
            overlay.style.opacity = slider.value;
            overlay.style.pointerEvents = 'none';
            overlay.style.cursor = 'default';
            clearHideTimer();
            isWidgetHidden = false;
            applyStyles();
        }
    });

    document.addEventListener('click', (e) => {
        if (isMenuOpen && !widget.contains(e.target)) {
            isMenuOpen = false;
            applyStyles();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isFullBlackout) {
            if (isWidgetHidden) {
                isWidgetHidden = false;
                applyStyles();
                startHideTimer();
            } else {
                isFullBlackout = false;
                overlay.style.opacity = slider.value;
                overlay.style.pointerEvents = 'none';
                overlay.style.cursor = 'default';
                clearHideTimer();
                isWidgetHidden = false;
                applyStyles();
            }
        }
    });

})();
