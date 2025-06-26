// 깡갤 복사기 확장프로그램
// SillyTavern용 자동 메시지 복사 도구

(function() {
    'use strict';

    console.log('🔥 깡갤 복사기: 스크립트 로드 시작!');

    let isInitialized = false;

    // settings.html 내용을 직접 포함 (404 오류 해결)
    const settingsHTML = `
    <div id="copybot_settings" class="extension_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>📋 깡갤 복사기(테스트)</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="copybot_panel">
                    <!-- 입력 섹션 -->
                    <div class="copybot_section">
                        <div class="copybot_input_row">
                            <div class="copybot_input_group">
                                <label for="copybot_start">시작위치:</label>
                                <input type="number" id="copybot_start" placeholder="0" min="0" class="text_pole">
                            </div>
                            
                            <div class="copybot_input_group">
                                <label for="copybot_end">종료위치:</label>
                                <input type="number" id="copybot_end" placeholder="10" min="0" class="text_pole">
                            </div>
                            
                            <button id="copybot_execute" class="menu_button" title="메시지를 클립보드에 복사하고 아래 텍스트박스에 표시">
                                단순 복사
                            </button>
                        </div>
                        
                        <small>메세지 범위 입력 후 단순 복사 버튼을 클릭하면 클립보드에 자동 복사&아래 텍스트박스에 해당 내용이 삽입됩니다.</small>
                    </div>
                    
                    <!-- 결과 섹션 -->
                    <div class="copybot_section">
                        <textarea id="copybot_textbox" placeholder="복사된 내용이 여기에 표시됩니다..." readonly></textarea>
                        
                        <div class="copybot_textbox_buttons">
                            <button id="copybot_remove_tags" class="copybot_textbox_button" title="텍스트박스에서 태그 제거" disabled>
                                태그 제거
                            </button>
                            <button id="copybot_linebreak_fix" class="copybot_textbox_button copybot_linebreak_button" title="텍스트박스에서 줄바꿈 정리" disabled>
                                줄바꿈 정리
                            </button>
                            <button id="copybot_copy_content" class="copybot_textbox_button" title="현재 텍스트박스 내용을 클립보드에 복사" disabled>
                                위 내용 복사
                            </button>
                            <button id="copybot_save_txt" class="copybot_textbox_button copybot_save_button" title="텍스트박스 내용을 txt 파일로 저장" disabled>
                                txt저장
                            </button>
                        </div>
                    </div>
                    
                    <!-- 메시지 이동 및 설정 섹션 -->
                    <div class="copybot_section copybot_section_dark">
                        <div class="copybot_jump_row">
                            <button id="copybot_jump_first" class="copybot_jump_button" title="첫 번째 메시지로 이동">
                                첫 메시지로
                            </button>
                            
                            <button id="copybot_jump_last" class="copybot_jump_button" title="마지막 메시지로 이동">
                                마지막 메시지로
                            </button>
                            
                            <div class="copybot_jump_input_group">
                                <input type="number" id="copybot_jump_number" placeholder="번호" min="0" class="text_pole">
                                <button id="copybot_jump_to" class="copybot_jump_button" title="지정한 메시지 번호로 이동">
                                    이동
                                </button>
                                <button id="copybot_open_settings_button" class="copybot_settings_button" title="설정 옵션">
                                    설정
                                </button>
                            </div>
                        </div>

                        <!-- 동적 액션 버튼이 표시될 컨테이너 -->
                        <div id="copybot_action_buttons" class="copybot_action_buttons_row"></div>
                        
                        <!-- 설정창 -->
                        <div id="copybot_settings_panel" class="copybot_settings_panel" style="display: none;">
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">작성중인 메세지 태그제거</span>
                                    <button id="copybot_tag_remove_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                                <div id="copybot_tag_remove_options" class="copybot_settings_sub" style="display: none;">
                                    <div class="copybot_settings_sub_row">
                                        <div class="copybot_settings_sub_item">
                                            <input type="checkbox" id="copybot_tag_remove_button" class="copybot_checkbox">
                                            <label for="copybot_tag_remove_button" class="copybot_settings_sub_label">복사기</label>
                                        </div>
                                        <div class="copybot_settings_sub_item">
                                            <input type="checkbox" id="copybot_tag_remove_icon" class="copybot_checkbox">
                                            <label for="copybot_tag_remove_icon" class="copybot_settings_sub_label">입력 필드</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">마지막 메세지 삭제</span>
                                    <button id="copybot_delete_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                                <div id="copybot_delete_options" class="copybot_settings_sub" style="display: none;">
                                    <div class="copybot_settings_sub_row">
                                        <div class="copybot_settings_sub_item">
                                            <input type="checkbox" id="copybot_delete_button" class="copybot_checkbox">
                                            <label for="copybot_delete_button" class="copybot_settings_sub_label">복사기</label>
                                        </div>
                                        <div class="copybot_settings_sub_item">
                                            <input type="checkbox" id="copybot_delete_icon" class="copybot_checkbox">
                                            <label for="copybot_delete_icon" class="copybot_settings_sub_label">입력 필드</label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">삭제후 재생성</span>
                                    <button id="copybot_delete_regenerate_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                                <div id="copybot_delete_regenerate_options" class="copybot_settings_sub" style="display: none;">
                                    <div class="copybot_settings_sub_row">
                                        <div class="copybot_settings_sub_item">
                                            <input type="checkbox" id="copybot_delete_regenerate_button" class="copybot_checkbox">
                                            <label for="copybot_delete_regenerate_button" class="copybot_settings_sub_label">복사기</label>
                                        </div>
                                        <div class="copybot_settings_sub_item">
                                            <input type="checkbox" id="copybot_delete_regenerate_icon" class="copybot_checkbox">
                                            <label for="copybot_delete_regenerate_icon" class="copybot_settings_sub_label">입력 필드</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 설명 섹션 -->
                            <div class="copybot_section copybot_description_section">
                                <div class="copybot_description">
                                    각 기능을 활성화한 후, <strong>복사기</strong> 체크박스를 선택하면 확장프로그램 내부에 버튼이 생성되고, <strong>입력 필드</strong> 체크박스를 선택하면 채팅 입력창 옆에 아이콘이 추가됩니다. 설정은 창을 닫을 때 자동 저장됩니다.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // ⭐️ [수정] 캐시 우회를 위한 새로운 재생성 함수
    function triggerCacheBustRegeneration() {
        console.log('깡갤 복사기: 캐시 우회 재생성 시작...');
        try {
            const context = window.SillyTavern.getContext();
            const chat = context.chat;

            if (!chat || chat.length === 0) {
                toastr.error('대화 기록이 없어 재생성할 수 없습니다.');
                return;
            }

            // 마지막 사용자 메시지를 찾아 인덱스와 내용을 저장
            let lastUserMessageIndex = -1;
            let originalMessage = '';
            for (let i = chat.length - 1; i >= 0; i--) {
                if (chat[i].is_user) {
                    lastUserMessageIndex = i;
                    originalMessage = chat[i].mes;
                    break;
                }
            }

            if (lastUserMessageIndex === -1) {
                toastr.error('마지막 사용자 메시지를 찾을 수 없어 재생성할 수 없습니다.');
                return;
            }

            // 보이지 않는 고유한 암호(Nonce) 생성
            const nonce = `<!-- regen-id:${Date.now()}-${Math.random()} -->`;
            
            // 컨텍스트 내의 마지막 사용자 메시지에 Nonce를 임시로 추가
            chat[lastUserMessageIndex].mes = `${originalMessage}\n${nonce}`;
            console.log('깡갤 복사기: Nonce가 추가된 임시 메시지로 재생성 요청');

            // /trigger 명령어를 실행하여 재생성 요청
            executeSimpleCommand('/trigger', '캐시를 우회하여 재생성합니다.', () => {
                // 재생성 요청 후, 임시로 추가했던 Nonce를 제거하여 메시지를 원상복구
                setTimeout(() => {
                    const currentChat = window.SillyTavern.getContext().chat;
                    if (currentChat[lastUserMessageIndex] && currentChat[lastUserMessageIndex].mes.includes(nonce)) {
                        currentChat[lastUserMessageIndex].mes = originalMessage;
                        console.log('깡갤 복사기: 마지막 사용자 메시지를 성공적으로 원상복구했습니다.');
                    }
                }, 1000); // 1초 후 복구하여 안정성 확보
            });

        } catch (error) {
            console.error('깡갤 복사기: 캐시 우회 재생성 중 오류 발생', error);
            toastr.error('캐시 우회 재생성 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
        }
    }


    // 설정 저장 함수
    function saveSettings() {
        try {
            const settings = {
                tagRemove: {
                    enabled: $('#copybot_tag_remove_toggle').attr('data-enabled') === 'true',
                    button: $('#copybot_tag_remove_button').is(':checked'),
                    icon: $('#copybot_tag_remove_icon').is(':checked')
                },
                delete: {
                    enabled: $('#copybot_delete_toggle').attr('data-enabled') === 'true',
                    button: $('#copybot_delete_button').is(':checked'),
                    icon: $('#copybot_delete_icon').is(':checked')
                },
                deleteRegenerate: {
                    enabled: $('#copybot_delete_regenerate_toggle').attr('data-enabled') === 'true',
                    button: $('#copybot_delete_regenerate_button').is(':checked'),
                    icon: $('#copybot_delete_regenerate_icon').is(':checked')
                }
            };
            localStorage.setItem('copybot_settings', JSON.stringify(settings));
            console.log('깡갤 복사기: 설정 저장 완료', settings);
        } catch (error) {
            console.error('깡갤 복사기: 설정 저장 실패', error);
        }
    }

    // 설정 로드 함수
    function loadSettings() {
        try {
            const savedSettings = localStorage.getItem('copybot_settings');
            if (!savedSettings) {
                console.log('깡갤 복사기: 저장된 설정이 없음');
                return;
            }

            const settings = JSON.parse(savedSettings);
            console.log('깡갤 복사기: 설정 로드 중', settings);

            // 토글 버튼 상태 복원
            $('#copybot_tag_remove_toggle').attr('data-enabled', settings.tagRemove.enabled).text(settings.tagRemove.enabled ? 'ON' : 'OFF');
            $('#copybot_delete_toggle').attr('data-enabled', settings.delete.enabled).text(settings.delete.enabled ? 'ON' : 'OFF');
            $('#copybot_delete_regenerate_toggle').attr('data-enabled', settings.deleteRegenerate.enabled).text(settings.deleteRegenerate.enabled ? 'ON' : 'OFF');

            // 체크박스 상태 복원
            $('#copybot_tag_remove_button').prop('checked', settings.tagRemove.button);
            $('#copybot_tag_remove_icon').prop('checked', settings.tagRemove.icon);
            $('#copybot_delete_button').prop('checked', settings.delete.button);
            $('#copybot_delete_icon').prop('checked', settings.delete.icon);
            $('#copybot_delete_regenerate_button').prop('checked', settings.deleteRegenerate.button);
            $('#copybot_delete_regenerate_icon').prop('checked', settings.deleteRegenerate.icon);

            // 옵션 패널 표시 상태 복원
            if (settings.tagRemove.enabled) $('#copybot_tag_remove_options').show();
            if (settings.delete.enabled) $('#copybot_delete_options').show();
            if (settings.deleteRegenerate.enabled) $('#copybot_delete_regenerate_options').show();

            console.log('깡갤 복사기: 설정 로드 완료');
        } catch (error) {
            console.error('깡갤 복사기: 설정 로드 실패', error);
        }
    }

    // 단순 명령어를 실행하고, 선택적으로 콜백을 실행하는 범용 함수
    async function executeSimpleCommand(command, successMessage, callback) {
        try {
            console.log(`깡갤 복사기: 실행 중인 명령어 - ${command}`);
            const chatInput = $('#send_textarea');
            if (chatInput.length > 0) {
                const originalText = chatInput.val();
                chatInput.val(command);
                chatInput.trigger('input');
                setTimeout(() => {
                    $('#send_but').click();
                    setTimeout(() => {
                        chatInput.val(originalText || '');
                        if (typeof callback === 'function') {
                            callback();
                        }
                    }, 500);
                }, 100);
                if (successMessage) {
                    toastr.success(successMessage);
                }
            } else {
                toastr.error('채팅 입력창을 찾을 수 없습니다.');
                console.error('깡갤 복사기: #send_textarea 요소를 찾을 수 없음');
            }
        } catch (error) {
            console.error('깡갤 복사기 명령어 실행 오류:', error);
            toastr.error('명령어 실행 중 오류가 발생했습니다.');
        }
    }

    // 메시지 복사 명령 실행 함수
    async function executeCopyCommand(start, end) {
        try {
            const command = `/messages names=off ${start}-${end} | /copy`;
            console.log(`깡갤 복사기: 실행 중인 명령어 - ${command}`);
            const chatInput = $('#send_textarea');
            if (chatInput.length > 0) {
                const originalText = chatInput.val();
                chatInput.val(command);
                chatInput.trigger('input');
                setTimeout(() => {
                    $('#send_but').click();
                    setTimeout(() => {
                        if (originalText) {
                            chatInput.val(originalText);
                        }
                    }, 500);
                }, 100);
                toastr.success(`메시지 ${start}-${end} 복사 명령 실행!`);
                setTimeout(async () => {
                    try {
                        const clipboardText = await navigator.clipboard.readText();
                        if (clipboardText && clipboardText.trim()) {
                            $('#copybot_textbox').val(clipboardText);
                            $('#copybot_remove_tags, #copybot_copy_content, #copybot_linebreak_fix, #copybot_save_txt').prop('disabled', false);
                            console.log('깡갤 복사기: 텍스트박스에 내용 표시 완료');
                        }
                    } catch (error) {
                        console.log('깡갤 복사기: 클립보드 읽기 실패 (권한 문제일 수 있음)', error);
                    }
                }, 2000);
            } else {
                toastr.error('채팅 입력창을 찾을 수 없습니다.');
                console.error('깡갤 복사기: #send_textarea 요소를 찾을 수 없음');
            }
        } catch (error) {
            console.error('깡갤 복사기 오류:', error);
            toastr.error('메시지 복사 중 오류가 발생했습니다.');
        }
    }

    // 메시지 이동 명령 실행 함수
    async function executeJumpCommand(messageNumber) {
        try {
            const command = `/chat-jump ${messageNumber}`;
            console.log(`깡갤 복사기: 실행 중인 이동 명령어 - ${command}`);
            const chatInput = $('#send_textarea');
            if (chatInput.length > 0) {
                const originalText = chatInput.val();
                chatInput.val(command);
                chatInput.trigger('input');
                setTimeout(() => {
                    $('#send_but').click();
                    setTimeout(() => {
                        if (originalText) {
                            chatInput.val(originalText);
                        }
                    }, 500);
                }, 100);
                toastr.success(messageNumber === '{{lastMessageId}}' ? '마지막 메시지로 이동!' : `메시지 #${messageNumber}로 이동!`);
            } else {
                toastr.error('채팅 입력창을 찾을 수 없습니다.');
                console.error('깡갤 복사기: #send_textarea 요소를 찾을 수 없음');
            }
        } catch (error) {
            console.error('깡갤 복사기 이동 오류:', error);
            toastr.error('메시지 이동 중 오류가 발생했습니다.');
        }
    }

    // 텍스트박스 내용을 클립보드에 복사하는 함수
    async function copyTextboxContent() {
        try {
            const textboxContent = $('#copybot_textbox').val();
            if (!textboxContent.trim()) {
                toastr.warning('텍스트박스에 복사할 내용이 없습니다.');
                return;
            }
            await navigator.clipboard.writeText(textboxContent);
            toastr.success('위 내용이 클립보드에 복사되었습니다!');
            console.log('깡갤 복사기: 텍스트박스 내용 클립보드 복사 완료');
        } catch (error) {
            console.error('깡갤 복사기: 클립보드 복사 실패', error);
            try {
                const textArea = document.createElement('textarea');
                textArea.value = $('#copybot_textbox').val();
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                toastr.success('위 내용이 클립보드에 복사되었습니다! (fallback)');
                console.log('깡갤 복사기: fallback 방법으로 클립보드 복사 완료');
            } catch (fallbackError) {
                console.error('깡갤 복사기: fallback 복사도 실패', fallbackError);
                toastr.error('클립보드 복사에 실패했습니다.');
            }
        }
    }

    // 특정 element에서 태그를 제거하는 범용 함수
    function removeTagsFromElement(selector) {
        try {
            const targetElement = $(selector);
            if (targetElement.length === 0) {
                toastr.error(`요소(${selector})를 찾을 수 없습니다.`);
                return;
            }

            const currentText = targetElement.val();
            if (!currentText.trim()) {
                toastr.warning('내용이 없습니다.');
                return;
            }

            console.log(`깡갤 복사기: ${selector} 태그 제거 시작, 원본 길이:`, currentText.length);

            let cleanedText = currentText;
            let iterationCount = 0;
            const maxIterations = 10;
            while (iterationCount < maxIterations) {
                const previousText = cleanedText;
                cleanedText = cleanedText.replace(/<([^>\/\s]+)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g, '');
                iterationCount++;
                if (cleanedText === previousText) break;
            }

            cleanedText = cleanedText.replace(/<[^>]*>/g, '');
            cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
            cleanedText = cleanedText.trim();

            console.log(`깡갤 복사기: 태그 제거 완료, 최종 길이:`, cleanedText.length);
            targetElement.val(cleanedText);
            targetElement.trigger('input');

            if (cleanedText.length < currentText.length) {
                const removedChars = currentText.length - cleanedText.length;
                toastr.success(`태그 제거 완료! (${removedChars}자 제거됨)`);
            } else {
                toastr.info('제거할 태그가 없습니다.');
            }
        } catch (error) {
            console.error('깡갤 복사기: 태그 제거 실패', error);
            toastr.error('태그 제거 중 오류가 발생했습니다.');
        }
    }

    // 설정 상태에 따라 동적 버튼을 업데이트하는 함수 (고정 순서로 정렬)
    function updateActionButtons() {
        const container = $('#copybot_action_buttons');
        
        // 기존 버튼들 모두 제거
        container.empty();
        
        // 고정 순서로 버튼 정의 (아이콘과 동일한 순서)
        const actionItems = [
            { toggleId: 'copybot_tag_remove_toggle', checkboxId: 'copybot_tag_remove_button', buttonId: 'copybot_action_remove_tags', buttonText: '작성중 태그제거' },
            { toggleId: 'copybot_delete_toggle', checkboxId: 'copybot_delete_button', buttonId: 'copybot_action_delete_last', buttonText: '마지막 메세지 삭제' },
            { toggleId: 'copybot_delete_regenerate_toggle', checkboxId: 'copybot_delete_regenerate_button', buttonId: 'copybot_action_delete_regen', buttonText: '삭제후 재생성' }
        ];

        // 고정 순서대로 버튼 생성
        actionItems.forEach(item => {
            const isToggleOn = $(`#${item.toggleId}`).attr('data-enabled') === 'true';
            const isButtonChecked = $(`#${item.checkboxId}`).is(':checked');

            if (isToggleOn && isButtonChecked) {
                container.append(`<button id="${item.buttonId}" class="copybot_action_button">${item.buttonText}</button>`);
            }
        });
    }

    // 입력 필드 아이콘들을 관리하는 함수
    function updateInputFieldIcons() {
        try {
            // 기존 아이콘들 제거
            document.querySelectorAll('.copybot_input_field_icon').forEach(icon => icon.remove());
            
            const rightForm = document.querySelector('#rightSendForm');
            if (!rightForm) {
                console.log('깡갤 복사기: #rightSendForm을 찾을 수 없음');
                return;
            }

            const sendButton = rightForm.querySelector('#send_but');
            if (!sendButton) {
                console.log('깡갤 복사기: #send_but을 찾을 수 없음');
                return;
            }

            // 아이콘 설정 정보
            const iconItems = [
                { 
                    toggleId: 'copybot_tag_remove_toggle', 
                    checkboxId: 'copybot_tag_remove_icon', 
                    iconClass: 'fa-tags', 
                    iconId: 'copybot_input_tag_remove',
                    title: '작성중인 메시지의 태그 제거',
                    action: () => removeTagsFromElement('#send_textarea')
                },
                { 
                    toggleId: 'copybot_delete_toggle', 
                    checkboxId: 'copybot_delete_icon', 
                    iconClass: 'fa-trash', 
                    iconId: 'copybot_input_delete',
                    title: '마지막 메시지 삭제',
                    action: () => executeSimpleCommand('/del 1', '마지막 메시지 1개를 삭제했습니다.')
                },
                { 
                    toggleId: 'copybot_delete_regenerate_toggle', 
                    checkboxId: 'copybot_delete_regenerate_icon', 
                    iconClass: 'fa-redo', 
                    iconId: 'copybot_input_delete_regen',
                    // ⭐️ [수정] 사용자에게 캐시 우회 기능임을 알려주는 툴팁
                    title: '마지막 메시지 삭제 후 재생성 (캐시 우회)',
                    // ⭐️ [수정] 캐시 우회 함수를 호출하도록 변경
                    action: () => executeSimpleCommand('/del 1', '마지막 메시지를 삭제하고 재생성합니다.', triggerCacheBustRegeneration)
                }
            ];

            // 설정에 따라 아이콘 생성
            iconItems.forEach(item => {
                const isToggleOn = $(`#${item.toggleId}`).attr('data-enabled') === 'true';
                const isIconChecked = $(`#${item.checkboxId}`).is(':checked');

                if (isToggleOn && isIconChecked) {
                    const icon = document.createElement('div');
                    icon.id = item.iconId;
                    icon.className = `fa-solid ${item.iconClass} interactable copybot_input_field_icon`;
                    icon.title = item.title;
                    
                    // SillyTavern 기존 아이콘과 동일한 스타일 적용
                    icon.style.cssText = `
                        font-size: 28.5px;
                        color: #ebebeb;
                        cursor: pointer;
                        margin: 0 2px;
                        padding: 0px;
                        transition: all 0.2s ease;
                    `;
                    
                    // 호버 효과
                    icon.addEventListener('mouseenter', () => {
                        icon.style.color = '#fff';
                        icon.style.opacity = '0.8';
                    });
                    icon.addEventListener('mouseleave', () => {
                        icon.style.color = '#ebebeb';
                        icon.style.opacity = '1';
                    });
                    
                    // 클릭 이벤트
                    icon.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                            item.action();
                        } catch (error) {
                            console.error('깡갤 복사기: 입력 필드 아이콘 클릭 오류', error);
                            toastr.error('기능 실행 중 오류가 발생했습니다.');
                        }
                    });
                    
                    // send_but 앞에 삽입
                    rightForm.insertBefore(icon, sendButton);
                    console.log(`깡갤 복사기: ${item.title} 아이콘 추가됨`);
                }
            });

        } catch (error) {
            console.error('깡갤 복사기: 입력 필드 아이콘 업데이트 실패', error);
        }
    }

    // UI 이벤트 설정 함수
    function setupEventHandlers() {
        console.log('깡갤 복사기: 이벤트 핸들러 설정 시작');
        
        $(document).off('click', '#copybot_execute').on('click', '#copybot_execute', function() {
            const startPos = parseInt($("#copybot_start").val());
            const endPos = parseInt($("#copybot_end").val());
            if (isNaN(startPos) || isNaN(endPos)) { toastr.error('올바른 숫자를 입력해주세요.'); return; }
            if (startPos > endPos) { toastr.error('시작위치는 종료위치보다 작아야 합니다.'); return; }
            if (startPos < 0) { toastr.error('시작위치는 0 이상이어야 합니다.'); return; }
            executeCopyCommand(startPos, endPos);
        });
        
        $(document).off('click', '#copybot_linebreak_fix').on('click', '#copybot_linebreak_fix', function() {
            try {
                const textbox = $('#copybot_textbox');
                const currentText = textbox.val();
                if (!currentText.trim()) {
                    toastr.warning('텍스트박스에 내용이 없습니다.');
                    return;
                }

                console.log('깡갤 복사기: 줄바꿈 정리 시작, 원본 길이:', currentText.length);

                let cleanedText = currentText;
                // 연속된 줄바꿈을 최대 2개로 제한
                cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
                // 앞뒤 공백 제거
                cleanedText = cleanedText.trim();

                console.log('깡갤 복사기: 줄바꿈 정리 완료, 최종 길이:', cleanedText.length);
                textbox.val(cleanedText);
                textbox.trigger('input');

                if (cleanedText.length !== currentText.length) {
                    const difference = Math.abs(currentText.length - cleanedText.length);
                    toastr.success(`줄바꿈 정리 완료! (${difference}자 변경됨)`);
                } else {
                    toastr.info('정리할 내용이 없습니다.');
                }
            } catch (error) {
                console.error('깡갤 복사기: 줄바꿈 정리 실패', error);
                toastr.error('줄바꿈 정리 중 오류가 발생했습니다.');
            }
        });

        $(document).off('click', '#copybot_save_txt').on('click', '#copybot_save_txt', function() {
            try {
                const textboxContent = $('#copybot_textbox').val();
                if (!textboxContent.trim()) {
                    toastr.warning('저장할 내용이 없습니다.');
                    return;
                }

                const blob = new Blob([textboxContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `깡갤복사기_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                toastr.success('txt 파일로 저장되었습니다!');
                console.log('깡갤 복사기: txt 파일 저장 완료');
            } catch (error) {
                console.error('깡갤 복사기: txt 저장 실패', error);
                toastr.error('파일 저장 중 오류가 발생했습니다.');
            }
        });

        $(document).off('click', '#copybot_remove_tags').on('click', '#copybot_remove_tags', () => removeTagsFromElement('#copybot_textbox'));
        
        $(document).off('click', '#copybot_copy_content').on('click', '#copybot_copy_content', copyTextboxContent);
        $(document).off('keypress', '#copybot_start, #copybot_end').on('keypress', '#copybot_start, #copybot_end', function(e) { if (e.which === 13) $("#copybot_execute").click(); });
        $(document).off('focus', '#copybot_textbox').on('focus', '#copybot_textbox', function() { $(this).prop('readonly', false); });
        $(document).off('input', '#copybot_textbox').on('input', '#copybot_textbox', function() {
            const hasContent = $(this).val().trim().length > 0;
            $('#copybot_copy_content, #copybot_remove_tags, #copybot_linebreak_fix, #copybot_save_txt').prop('disabled', !hasContent);
        });

        $(document).off('click', '#copybot_jump_first').on('click', '#copybot_jump_first', function() {
            if (confirm("첫 메시지로 이동합니다.\n\n누적된 채팅이 많을 경우 심한 렉에 걸리거나 튕길 수 있습니다.\n\n정말 이동하시겠습니까?\n실수로 누른 거라면 '취소'를 눌러주세요.")) {
                executeJumpCommand(0);
            } else {
                toastr.info('이동이 취소되었습니다.');
            }
        });
        $(document).off('click', '#copybot_jump_last').on('click', '#copybot_jump_last', () => executeJumpCommand('{{lastMessageId}}'));
        $(document).off('click', '#copybot_jump_to').on('click', '#copybot_jump_to', function() {
            const jumpNumber = parseInt($("#copybot_jump_number").val());
            if (isNaN(jumpNumber)) { toastr.error('올바른 메시지 번호를 입력해주세요.'); return; }
            if (jumpNumber < 0) { toastr.error('메시지 번호는 0 이상이어야 합니다.'); return; }
            executeJumpCommand(jumpNumber);
        });
        $(document).off('keypress', '#copybot_jump_number').on('keypress', '#copybot_jump_number', function(e) { if (e.which === 13) $("#copybot_jump_to").click(); });

        $(document).off('click', '#copybot_open_settings_button').on('click', '#copybot_open_settings_button', function(e) {
            e.stopPropagation();
            const settingsPanel = $('#copybot_settings_panel');
            if (settingsPanel.is(':visible')) {
                settingsPanel.slideUp(200, () => {
                    saveSettings();
                    toastr.success('설정이 저장되었습니다.');
                });
            } else {
                settingsPanel.slideDown(200);
            }
        });

        $(document).off('click', '.copybot_toggle_button').on('click', '.copybot_toggle_button', function(e) {
            e.stopPropagation();
            const button = $(this);
            const isEnabled = button.attr('data-enabled') === 'true';
            button.attr('data-enabled', !isEnabled).text(isEnabled ? 'OFF' : 'ON');
            const optionsPanelId = `#${button.attr('id').replace('_toggle', '_options')}`;
            $(optionsPanelId).slideToggle(!isEnabled);
            updateActionButtons();
            updateInputFieldIcons(); // 입력 필드 아이콘도 업데이트
            saveSettings(); // 설정 변경시 자동 저장
        });

        $(document).off('change', '.copybot_checkbox').on('change', '.copybot_checkbox', function(e) {
            e.stopPropagation();
            updateActionButtons();
            updateInputFieldIcons(); // 입력 필드 아이콘도 업데이트
            saveSettings(); // 설정 변경시 자동 저장
        });
        
        $(document).off('click', '#copybot_settings_panel').on('click', '#copybot_settings_panel', (e) => e.stopPropagation());
        
        // 동적으로 생성된 액션 버튼들의 클릭 이벤트 핸들러
        $(document).on('click', '.copybot_action_button', function() {
            const buttonId = $(this).attr('id');
            switch (buttonId) {
                case 'copybot_action_remove_tags':
                    removeTagsFromElement('#send_textarea');
                    break;
                case 'copybot_action_delete_last':
                    executeSimpleCommand('/del 1', '마지막 메시지 1개를 삭제했습니다.');
                    break;
                case 'copybot_action_delete_regen':
                    // ⭐️ [수정] 캐시 우회 함수를 호출하도록 변경
                    executeSimpleCommand('/del 1', '마지막 메시지를 삭제하고 재생성합니다.', triggerCacheBustRegeneration);
                    break;
            }
        });

        console.log('깡갤 복사기: 이벤트 핸들러 설정 완료');
    }

    // 초기화 함수
    async function initialize() {
        if (isInitialized) return;
        isInitialized = true;
        console.log('깡갤 복사기: 초기화 시작...');
        try {
            if ($("#extensions_settings2").length > 0) {
                $("#extensions_settings2").append(settingsHTML);
                console.log('깡갤 복사기: UI 추가 성공');
                setupEventHandlers();
                
                // 설정 로드 및 UI 업데이트
                setTimeout(() => {
                    loadSettings();
                    updateActionButtons();
                    updateInputFieldIcons(); // 입력 필드 아이콘도 초기화
                }, 100);
                
                console.log('깡갤 복사기: ✅ 초기화 완료!');
            } else {
                console.warn('깡갤 복사기: #extensions_settings2 요소를 찾을 수 없음. 3초 후 재시도...');
                setTimeout(() => { isInitialized = false; initialize(); }, 3000);
            }
        } catch(e) {
            console.error("깡갤 복사기: 초기화 실패", e);
        }
    }

    $(document).ready(function() {
        console.log('깡갤 복사기: DOM 준비 완료');
        setTimeout(initialize, 1000);
        $(document).on('characterSelected chat_render_complete CHAT_CHANGED', () => {
            setTimeout(() => { if (!isInitialized) initialize(); }, 500);
        });
        $(document).on('change', '#character_select', () => {
            setTimeout(() => { if (!isInitialized) initialize(); }, 200);
        });
        $(document).on('click', '[data-i18n="Extensions"]', () => {
            setTimeout(() => { if (!isInitialized) initialize(); }, 500);
        });
        setTimeout(() => {
            if (!isInitialized) {
                console.log('깡갤 복사기: 타이머 강제 초기화 실행');
                initialize();
            }
        }, 5000);
    });

    console.log('깡갤 복사기 확장프로그램이 로드되었습니다.');
})();