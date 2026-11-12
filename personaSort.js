// 페르소나 생성순: 실리의 FilterHelper 확장 지점과 기존 페이지/카드 렌더러를 사용합니다.
// 감시·폴링·실리 함수 교체 없음. OFF에서는 필터와 입력 리스너를 모두 제거합니다.
(function () {
    'use strict';
    const KEY = 'copybot_persona_created';
    const modes = ['oldest', 'newest'];
    let enabled = false, mode = '', api = null, select = null, options = [], revision = 0;

    function creationTime(id) {
        // 실리 기본 업로드 파일명 = Date.now() + .png. 임의 이름/초 단위 숫자는 추측하지 않습니다.
        const match = /^(\d{13})\.(?:png|jpe?g|webp|gif)$/i.exec(String(id));
        const time = match ? Number(match[1]) : NaN;
        return time >= Date.UTC(2000, 0, 1) && time <= Date.now() ? time : null;
    }

    function ordered(ids, direction, names = {}) {
        return [...ids].sort((a, b) => {
            const ta = creationTime(a), tb = creationTime(b);
            if (ta === null && tb !== null) return 1;
            if (tb === null && ta !== null) return -1;
            if (ta !== null && tb !== null && ta !== tb) return (ta - tb) * (direction === 'newest' ? -1 : 1);
            return String(names[a] || a).localeCompare(String(names[b] || b)) || String(a).localeCompare(String(b));
        });
    }

    function filter(data) {
        if (!enabled || !select?.isConnected) return data;
        if (!modes.includes(mode) || !Array.isArray(data)) return data;
        const option = options.find(item => item.dataset.copybotCreated === mode);
        if (!option) return data;
        const optionValue = option.value;
        option.value = 'search';
        option.selected = true;
        const helper = api.personasFilter;
        const previous = helper.scoreCache.get('persona_search');
        const ranks = new Map(ordered(data, mode, window.SillyTavern?.getContext()?.powerUserSettings?.personas)
            .map((id, rank) => [id, rank]));
        // 실리의 검색순 비교기가 점수를 읽는 현재 렌더 작업에만 생성순 순위를 제공합니다.
        // 동기 렌더 구간에만 실리가 지원하는 일시 정렬 값(search)을 사용하고 즉시 돌려놓습니다.
        // 평소 값은 서로 달라서 실리의 검색 옵션 선택/숨김 규칙에 끼어들지 않습니다.
        helper.scoreCache.set('persona_search', ranks);
        queueMicrotask(() => {
            option.value = optionValue;
            if (helper.scoreCache.get('persona_search') !== ranks) return;
            if (previous) helper.scoreCache.set('persona_search', previous);
            else helper.scoreCache.delete('persona_search');
        });
        return data;
    }

    function onInput(event) {
        mode = select.selectedOptions[0]?.dataset.copybotCreated || '';
        window.CopyBotSettings?.saveSettings();
        if (mode) {
            // 우리가 추가한 항목만 처리합니다. 실리 설정에 모르는 정렬 값을 저장하지 않습니다.
            event.stopImmediatePropagation();
            api.getUserAvatars().catch(() => window.toastr?.warning('페르소나 목록을 불러오지 못했습니다.'));
        }
    }

    function detach() {
        const selectedOurs = !!select?.selectedOptions[0]?.dataset.copybotCreated;
        if (api?.personasFilter?.filterFunctions[KEY] === filter) delete api.personasFilter.filterFunctions[KEY];
        select?.removeEventListener('input', onInput, true);
        options.forEach(option => option.remove());
        options = [];
        if (select && (selectedOurs || select.selectedIndex < 0)) {
            select.value = window.SillyTavern?.getContext()?.powerUserSettings?.persona_sort_order || 'asc';
        }
        select = null;
    }

    async function configure(value, savedMode = mode) {
        const token = ++revision;
        const wasActive = enabled && modes.includes(mode);
        enabled = value === true;
        mode = modes.includes(savedMode) ? savedMode : '';
        detach();
        try {
            if (!enabled) {
                if (wasActive && api) await api.getUserAvatars();
                return;
            }
            const loaded = await import('/scripts/personas.js');
            if (token !== revision || !enabled) return;
            const target = document.getElementById('persona_sort_order');
            if (!target || !loaded.personasFilter?.filterFunctions || !(loaded.personasFilter.scoreCache instanceof Map)
                || typeof loaded.getUserAvatars !== 'function' || !target.querySelector('option[value="search"]')) {
                throw new Error('페르소나 정렬 확장 지점을 찾지 못했습니다.');
            }
            api = loaded;
            select = target;
            for (const [direction, label] of [['oldest', '과거순'], ['newest', '최신순']]) {
                const option = document.createElement('option');
                option.value = KEY + '_' + direction;
                option.dataset.copybotCreated = direction;
                option.textContent = label;
                options.push(option);
                select.append(option);
            }
            api.personasFilter.filterFunctions[KEY] = filter;
            select.addEventListener('input', onInput, true);
            if (mode) await api.getUserAvatars();
        } catch (error) {
            if (token !== revision) return;
            detach();
            window.toastr?.warning('이 실리 버전에서는 페르소나 생성순 정렬을 적용할 수 없습니다. 기존 정렬을 사용합니다.');
            window.CopyBotUtils?.debugLog(window.copybot_debug_mode, error.message);
        }
    }

    window.CopyBotPersonaSort = { configure, getMode: () => mode, creationTime, ordered };
})();
