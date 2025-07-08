// 깡갤 복사기 확장프로그램
// SillyTavern용 자동 메시지 복사 도구

(function() {
    'use strict';

    console.log('🔥 깡갤 복사기: 스크립트 로드 시작!');

    let isInitialized = false;

    // 색상 변환을 위한 헬퍼 함수들
    function rgbStringToObj(rgbStr) {
        const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return { r: 0, g: 0, b: 0, a: 1 };
        return {
            r: parseInt(match[1], 10),
            g: parseInt(match[2], 10),
            b: parseInt(match[3], 10),
            a: match[4] !== undefined ? parseFloat(match[4]) : 1,
        };
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0; // 흑백
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }
    
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
                            </div>
                            
                            <div class="copybot_settings_buttons_group">
                                <button id="copybot_open_ghostwrite_button" class="copybot_settings_button" title="대필 옵션">
                                    대필
                                </button>
                                <button id="copybot_open_settings_button" class="copybot_settings_button" title="편의기능 옵션">
                                    편의기능
                                </button>
                            </div>
                        </div>

                        <!-- 동적 액션 버튼이 표시될 컨테이너 -->
                        <div id="copybot_action_buttons" class="copybot_action_buttons_row"></div>
                        
                        <!-- 대필 설정창 -->
                        <div id="copybot_ghostwrite_panel" class="copybot_settings_panel" style="display: none;">
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">대필 프롬프트(명령하기)</span>
                                    <button id="copybot_ghostwrite_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                                <textarea id="copybot_ghostwrite_textbox" placeholder="5문장 이하로, 정중한 말투, 1인칭, NSFW 등..." class="copybot_ghostwrite_text" style="margin-top: 12px; display: none;"></textarea>
                            </div>
                            
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">대필 버튼 위치</span>
                                </div>
                                <div id="copybot_ghostwrite_position_options" class="copybot_settings_sub" style="display: none;">
                                    <div class="copybot_settings_sub_row" style="flex-wrap: wrap;">
                                        <div class="copybot_settings_sub_item" style="flex-basis: 45%;">
                                            <input type="radio" id="copybot_ghostwrite_position_left" name="copybot_ghostwrite_position" value="left" class="copybot_radio">
                                            <label for="copybot_ghostwrite_position_left" class="copybot_settings_sub_label">좌측</label>
                                        </div>
                                        <div class="copybot_settings_sub_item" style="flex-basis: 45%;">
                                            <input type="radio" id="copybot_ghostwrite_position_bottom_right" name="copybot_ghostwrite_position" value="bottom_right" class="copybot_radio">
                                            <label for="copybot_ghostwrite_position_bottom_right" class="copybot_settings_sub_label">우상단</label>
                                        </div>
                                        <div class="copybot_settings_sub_item" style="flex-basis: 45%;">
                                            <input type="radio" id="copybot_ghostwrite_position_bottom_left" name="copybot_ghostwrite_position" value="bottom_left" class="copybot_radio">
                                            <label for="copybot_ghostwrite_position_bottom_left" class="copybot_settings_sub_label">좌하단</label>
                                        </div>
                                        <div class="copybot_settings_sub_item" style="flex-basis: 45%;">
                                            <input type="radio" id="copybot_ghostwrite_position_right" name="copybot_ghostwrite_position" value="right" class="copybot_radio" checked>
                                            <label for="copybot_ghostwrite_position_right" class="copybot_settings_sub_label">기본(우측)</label>
                                        </div>
                                    </div>
                                </div>
                                <div class="copybot_description" style="margin-top: 10px; font-size:12px; color: #666; display:none;">
                                    대필 아이콘(<i class="fa-solid fa-user-edit"></i>)을 누르면, 위에 써진 내용(프롬프트)와 채팅창의 내용을 조합하여 사용자를 대신해 봇이 글을 써줍니다. (비어있는 곳은 알아서 무시합니다)
                                </div>
                            </div>
                        </div>
                        
                        <!-- 편의기능 설정창 -->
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

                            <!-- 입력필드 위치 설정 섹션 -->
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">3종 아이콘 위치</span>
                                </div>
                                <div class="copybot_settings_sub" style="display: block;">
                                    <div class="copybot_settings_sub_row" style="flex-wrap: wrap;">
                                        <div class="copybot_settings_sub_item" style="flex-basis: 45%;">
                                            <input type="radio" id="copybot_position_left" name="copybot_position" value="left" class="copybot_radio">
                                            <label for="copybot_position_left" class="copybot_settings_sub_label">좌측</label>
                                        </div>
                                        <div class="copybot_settings_sub_item" style="flex-basis: 45%;">
                                            <input type="radio" id="copybot_position_bottom_right" name="copybot_position" value="bottom_right" class="copybot_radio">
                                            <label for="copybot_position_bottom_right" class="copybot_settings_sub_label">우상단</label>
                                        </div>
                                        <div class="copybot_settings_sub_item" style="flex-basis: 45%;">
                                            <input type="radio" id="copybot_position_bottom_left" name="copybot_position" value="bottom_left" class="copybot_radio">
                                            <label for="copybot_position_bottom_left" class="copybot_settings_sub_label">좌하단</label>
                                        </div>
                                        <div class="copybot_settings_sub_item" style="flex-basis: 45%;">
                                            <input type="radio" id="copybot_position_right" name="copybot_position" value="right" class="copybot_radio" checked>
                                            <label for="copybot_position_right" class="copybot_settings_sub_label">기본(우측)</label>
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

    // 캐시 우회를 위한 새로운 재생성 함수
    function triggerCacheBustRegeneration() {
        console.log('깡갤 복사기: 캐시 우회 재생성 시작...');
        try {
            const context = window.SillyTavern.getContext();
            const chat = context.chat;

            if (!chat || chat.length === 0) {
                toastr.error('대화 기록이 없어 재생성할 수 없습니다.');
                return;
            }

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

            const nonce = `<!-- regen-id:${Date.now()}-${Math.random()} -->`;
            
            chat[lastUserMessageIndex].mes = `${originalMessage}\n${nonce}`;
            console.log('깡갤 복사기: Nonce가 추가된 임시 메시지로 재생성 요청');

            executeSimpleCommand('/trigger', '캐시를 우회하여 재생성합니다.', () => {
                setTimeout(() => {
                    const currentChat = window.SillyTavern.getContext().chat;
                    if (currentChat[lastUserMessageIndex] && currentChat[lastUserMessageIndex].mes.includes(nonce)) {
                        currentChat[lastUserMessageIndex].mes = originalMessage;
                        console.log('깡갤 복사기: 마지막 사용자 메시지를 성공적으로 원상복구했습니다.');
                    }
                }, 1000);
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
                position: $('input[name="copybot_position"]:checked').val() || 'right',
                ghostwrite: {
                    enabled: $('#copybot_ghostwrite_toggle').attr('data-enabled') === 'true',
                    text: $('#copybot_ghostwrite_textbox').val() || '',
                    position: $('input[name="copybot_ghostwrite_position"]:checked').val() || 'right'
                },
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

            if (settings.position) {
                $(`input[name="copybot_position"][value="${settings.position}"]`).prop('checked', true);
            }

            if (settings.ghostwrite) {
                const isGhostwriteEnabled = settings.ghostwrite.enabled === true;
                $('#copybot_ghostwrite_toggle').attr('data-enabled', isGhostwriteEnabled).text(isGhostwriteEnabled ? 'ON' : 'OFF');
                $('#copybot_ghostwrite_textbox').val(settings.ghostwrite.text || '');
                if (settings.ghostwrite.position) {
                    $(`input[name="copybot_ghostwrite_position"][value="${settings.ghostwrite.position}"]`).prop('checked', true);
                }
                 if (isGhostwriteEnabled) {
                    $('#copybot_ghostwrite_position_options, #copybot_ghostwrite_panel .copybot_description').show();
                    $('#copybot_ghostwrite_textbox').show();
                } else {
                    $('#copybot_ghostwrite_position_options, #copybot_ghostwrite_panel .copybot_description').hide();
                    $('#copybot_ghostwrite_textbox').hide();
                }
            }

            $('#copybot_tag_remove_toggle').attr('data-enabled', settings.tagRemove.enabled).text(settings.tagRemove.enabled ? 'ON' : 'OFF');
            $('#copybot_delete_toggle').attr('data-enabled', settings.delete.enabled).text(settings.delete.enabled ? 'ON' : 'OFF');
            $('#copybot_delete_regenerate_toggle').attr('data-enabled', settings.deleteRegenerate.enabled).text(settings.deleteRegenerate.enabled ? 'ON' : 'OFF');

            $('#copybot_tag_remove_button').prop('checked', settings.tagRemove.button);
            $('#copybot_tag_remove_icon').prop('checked', settings.tagRemove.icon);
            $('#copybot_delete_button').prop('checked', settings.delete.button);
            $('#copybot_delete_icon').prop('checked', settings.delete.icon);
            $('#copybot_delete_regenerate_button').prop('checked', settings.deleteRegenerate.button);
            $('#copybot_delete_regenerate_icon').prop('checked', settings.deleteRegenerate.icon);

            if (settings.tagRemove.enabled) $('#copybot_tag_remove_options').show(); else $('#copybot_tag_remove_options').hide();
            if (settings.delete.enabled) $('#copybot_delete_options').show(); else $('#copybot_delete_options').hide();
            if (settings.deleteRegenerate.enabled) $('#copybot_delete_regenerate_options').show(); else $('#copybot_delete_regenerate_options').hide();
            
            console.log('깡갤 복사기: 설정 로드 완료');
        } catch (error)
        {
            console.error('깡갤 복사기: 설정 로드 실패', error);
        }
    }
    
    // 대필 명령 실행 함수
    function executeGhostwrite() {
        try {
            const promptText = $('#copybot_ghostwrite_textbox').val().trim();
            const chatInput = $('#send_textarea');
            const chatInputText = chatInput.val().trim();
            
            let finalPrompt = '';

            if (promptText) {
                finalPrompt += promptText;
            }
            if (chatInputText) {
                if (finalPrompt) finalPrompt += ' '; 
                finalPrompt += chatInputText;
            }

            let command = '/impersonate {{char}}';
            if (finalPrompt) {
                command += ` ${finalPrompt}`;
            }
            
            let toastMessage = '대필 명령을 실행합니다.';
            if (finalPrompt) {
                toastMessage = `대필 명령 실행: ${finalPrompt}`;
            }

            executeSimpleCommand(command, toastMessage, null, true);

        } catch (error) {
            console.error('깡갤 복사기: 대필 실행 중 오류', error);
            toastr.error('대필 실행 중 오류가 발생했습니다.');
        }
    }

    // 단순 명령어를 실행하는 범용 함수
    async function executeSimpleCommand(command, successMessage, callback, isGhostwriting = false) {
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
                        if (!isGhostwriting) {
                            chatInput.val(originalText || '');
                        } else {
                            chatInput.val(''); 
                        }
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
            executeSimpleCommand(command, `메시지 ${start}-${end} 복사 명령 실행!`);
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
        } catch (error) {
            console.error('깡갤 복사기 오류:', error);
            toastr.error('메시지 복사 중 오류가 발생했습니다.');
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

    // 설정 상태에 따라 동적 버튼을 업데이트하는 함수
    function updateActionButtons() {
        const container = $('#copybot_action_buttons');
        container.empty();
        
        const actionItems = [
            { toggleId: 'copybot_tag_remove_toggle', checkboxId: 'copybot_tag_remove_button', buttonId: 'copybot_action_remove_tags', buttonText: '작성중 태그제거' },
            { toggleId: 'copybot_delete_toggle', checkboxId: 'copybot_delete_button', buttonId: 'copybot_action_delete_last', buttonText: '마지막 메세지 삭제' },
            { toggleId: 'copybot_delete_regenerate_toggle', checkboxId: 'copybot_delete_regenerate_button', buttonId: 'copybot_action_delete_regen', buttonText: '삭제후 재생성' }
        ];

        actionItems.forEach(item => {
            if ($(`#${item.toggleId}`).attr('data-enabled') === 'true' && $(`#${item.checkboxId}`).is(':checked')) {
                container.append(`<button id="${item.buttonId}" class="copybot_action_button">${item.buttonText}</button>`);
            }
        });
    }

    // 통합 아이콘 관리 함수
    function updateInputFieldIcons() {
        try {
            document.querySelectorAll('.copybot_input_field_icon, .copybot_independent_container').forEach(el => el.remove());

            const rightSendForm = document.querySelector('#rightSendForm');
            const textarea = document.querySelector('#send_textarea');
            const leftSendForm = document.querySelector('#leftSendForm');

            if (leftSendForm) { 
                leftSendForm.style.flexWrap = ''; 
                leftSendForm.style.maxWidth = '';
                Array.from(leftSendForm.children).forEach(child => {
                    if (!child.classList.contains('copybot_input_field_icon')) child.style.order = '';
                });
            }
            
            const referenceIcon = document.querySelector('#send_but');
            if (!referenceIcon) return;

            const computedStyle = window.getComputedStyle(referenceIcon);
            const themeIconSize = computedStyle.fontSize;
            const themeIconColor = computedStyle.color;

            const iconsByPosition = { right: [], left: [], bottom_right: [], bottom_left: [] };

            const allIconItems = [
                { type: 'ghostwrite', toggleId: 'copybot_ghostwrite_toggle', iconClass: 'fa-user-edit', title: '캐릭터에게 대필 요청', action: executeGhostwrite, group: 20 },
                { type: 'action', toggleId: 'copybot_tag_remove_toggle', iconClass: 'fa-tags', title: '작성중인 메시지의 태그 제거', action: () => removeTagsFromElement('#send_textarea'), group: 20 },
                { type: 'action', toggleId: 'copybot_delete_toggle', iconClass: 'fa-trash', title: '마지막 메시지 삭제', action: () => executeSimpleCommand('/del 1', '마지막 메시지 1개를 삭제했습니다.'), group: 20 },
                { type: 'action', toggleId: 'copybot_delete_regenerate_toggle', iconClass: 'fa-redo', title: '마지막 메시지 삭제 후 재생성', action: () => executeSimpleCommand('/del 1', '마지막 메시지를 삭제하고 재생성합니다.', triggerCacheBustRegeneration), group: 30 }
            ];

            allIconItems.forEach(item => {
                const isToggleOn = $(`#${item.toggleId}`).attr('data-enabled') === 'true';
                const isIconChecked = item.type === 'ghostwrite' ? true : $(`#${item.toggleId.replace('toggle', 'icon')}`).is(':checked');

                if (isToggleOn && isIconChecked) {
                    const positionName = item.type === 'ghostwrite' ? 'copybot_ghostwrite_position' : 'copybot_position';
                    const targetPosition = $(`input[name="${positionName}"]:checked`).val() || 'right';
                    
                    const icon = document.createElement('div');
                    icon.className = `fa-solid ${item.iconClass} copybot_input_field_icon`;
                    icon.title = item.title;
                    icon.style.fontSize = themeIconSize;
                    icon.style.color = themeIconColor;
                    icon.style.order = item.group;
                    icon.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); item.action(); });
                    
                    iconsByPosition[targetPosition].push(icon);
                }
            });

            for (const position in iconsByPosition) {
                const iconsToAdd = iconsByPosition[position];
                if (iconsToAdd.length === 0) continue;

                switch(position) {
                    case 'bottom_left':
                    case 'left':
                    case 'right':
                        iconsToAdd.forEach(icon => icon.classList.add('interactable'));
                        if (position === 'bottom_left' && leftSendForm) {
                            Array.from(leftSendForm.children).forEach(child => { child.style.order = '10'; });
                            const originalWidth = leftSendForm.getBoundingClientRect().width;
                            if (originalWidth > 0) leftSendForm.style.maxWidth = `${originalWidth}px`;
                            leftSendForm.style.flexWrap = 'wrap';
                            iconsToAdd.forEach(icon => leftSendForm.appendChild(icon));
                        } else if (position === 'left' && leftSendForm) {
                            iconsToAdd.forEach(icon => { icon.style.order = ''; leftSendForm.appendChild(icon); });
                        } else if (position === 'right' && rightSendForm) {
                            const sendButton = rightSendForm.querySelector('#send_but');
                            if (sendButton) iconsToAdd.forEach(icon => { icon.style.order = ''; rightSendForm.insertBefore(icon, sendButton); });
                        }
                        break;
                    
                    case 'bottom_right':
                        const textareaParent = textarea.closest('#send_form') || textarea.parentElement;
                        if (textareaParent) {
                            const { r, g, b } = rgbStringToObj(themeIconColor);
                            const { h, s } = rgbToHsl(r, g, b);
                            const hoverColor = `hsl(${h}, ${s}%, 35%)`;
                            const activeColor = `hsl(${h}, ${s}%, 25%)`;
                            
                            let iconSize = Math.max(referenceIcon.offsetWidth, referenceIcon.offsetHeight, 32);
                            const minimalOffset = (iconSize * 2) + 8 - 10;
                            const independentContainer = document.createElement('div');
                            independentContainer.className = 'copybot_independent_container';
                            
                            iconsToAdd.forEach(icon => {
                                icon.style.margin = '0 3px';
                                icon.style.transition = 'color 0.2s ease';
                                icon.addEventListener('mouseenter', () => { icon.style.color = hoverColor; });
                                icon.addEventListener('mouseleave', () => { icon.style.color = themeIconColor; });
                                icon.addEventListener('mousedown', () => { icon.style.color = activeColor; });
                                icon.addEventListener('mouseup', () => { icon.style.color = hoverColor; });
                                independentContainer.appendChild(icon);
                            });
                            
                            textareaParent.style.position = 'relative';
                            independentContainer.style.cssText = `position:absolute!important;top:0!important;right:${minimalOffset}px!important;transform:translateY(calc(-100% - 4px))!important;display:flex!important;gap:6px!important;align-items:center!important;background:rgba(var(--bg-color-rgb),0.8)!important;backdrop-filter:blur(5px)!important;border-radius:6px!important;padding:4px 8px!important;border:1px solid var(--border-color)!important;box-shadow:0 2px 8px rgba(0,0,0,0.15)!important;z-index:1000!important;`;
                            textareaParent.appendChild(independentContainer);
                        }
                        break;
                }
            }
            console.log('깡갤 복사기: 아이콘 업데이트 완료');
        } catch (error) {
            console.error('깡갤 복사기: 입력 필드 아이콘 업데이트 실패', error);
        }
    }


    // UI 이벤트 설정 함수
    function setupEventHandlers() {
        console.log('깡갤 복사기: 이벤트 핸들러 설정 시작');
        
        const eventMap = {
            '#copybot_execute': () => {
                const startPos = parseInt($("#copybot_start").val());
                const endPos = parseInt($("#copybot_end").val());
                if (isNaN(startPos) || isNaN(endPos)) { toastr.error('올바른 숫자를 입력해주세요.'); return; }
                if (startPos > endPos) { toastr.error('시작위치는 종료위치보다 작아야 합니다.'); return; }
                if (startPos < 0) { toastr.error('시작위치는 0 이상이어야 합니다.'); return; }
                executeCopyCommand(startPos, endPos);
            },
            '#copybot_linebreak_fix': () => {
                const textbox = $('#copybot_textbox');
                const currentText = textbox.val();
                if (!currentText.trim()) { toastr.warning('텍스트박스에 내용이 없습니다.'); return; }
                const cleanedText = currentText.replace(/\n{3,}/g, '\n\n').trim();
                textbox.val(cleanedText).trigger('input');
                if (cleanedText.length !== currentText.length) toastr.success(`줄바꿈 정리 완료!`);
                else toastr.info('정리할 내용이 없습니다.');
            },
            '#copybot_save_txt': () => {
                const textboxContent = $('#copybot_textbox').val();
                if (!textboxContent.trim()) { toastr.warning('저장할 내용이 없습니다.'); return; }
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
            },
            '#copybot_remove_tags': () => removeTagsFromElement('#copybot_textbox'),
            '#copybot_copy_content': copyTextboxContent,
            '#copybot_jump_first': () => {
                if (confirm("첫 메시지로 이동합니다.\n\n누적된 채팅이 많을 경우 심한 렉에 걸리거나 튕길 수 있습니다.\n\n정말 이동하시겠습니까?\n실수로 누른 거라면 '취소'를 눌러주세요.")) {
                    executeSimpleCommand('/chat-jump 0', '첫 메시지로 이동!');
                } else {
                    toastr.info('이동이 취소되었습니다.');
                }
            },
            '#copybot_jump_last': () => executeSimpleCommand('/chat-jump {{lastMessageId}}', '마지막 메시지로 이동!'),
            '#copybot_jump_to': () => {
                const jumpNumber = parseInt($("#copybot_jump_number").val());
                if (isNaN(jumpNumber) || jumpNumber < 0) { toastr.error('올바른 메시지 번호를 입력해주세요.'); return; }
                executeSimpleCommand(`/chat-jump ${jumpNumber}`, `메시지 #${jumpNumber}로 이동!`);
            },
            '#copybot_open_ghostwrite_button': (e) => {
                e.stopPropagation();
                $('#copybot_settings_panel').slideUp(200);
                $('#copybot_ghostwrite_panel').slideToggle(200, saveSettings);
            },
            '#copybot_open_settings_button': (e) => {
                e.stopPropagation();
                $('#copybot_ghostwrite_panel').slideUp(200);
                $('#copybot_settings_panel').slideToggle(200, () => {
                    saveSettings();
                    toastr.success('설정이 저장되었습니다.');
                });
            },
            '.copybot_toggle_button': function(e) {
                e.stopPropagation();
                const button = $(this);
                const isEnabled = button.attr('data-enabled') === 'true';
                button.attr('data-enabled', !isEnabled).text(isEnabled ? 'OFF' : 'ON');
                const targetPanel = button.attr('id') === 'copybot_ghostwrite_toggle'
                    ? $('#copybot_ghostwrite_position_options, #copybot_ghostwrite_textbox, #copybot_ghostwrite_panel .copybot_description')
                    : $(`#${button.attr('id').replace('_toggle', '_options')}`);
                targetPanel.slideToggle(!isEnabled);
                updateActionButtons();
                updateInputFieldIcons();
                saveSettings();
            },
            '.copybot_action_button': function() {
                const actions = {
                    'copybot_action_remove_tags': () => removeTagsFromElement('#send_textarea'),
                    'copybot_action_delete_last': () => executeSimpleCommand('/del 1', '마지막 메시지 1개를 삭제했습니다.'),
                    'copybot_action_delete_regen': () => executeSimpleCommand('/del 1', '마지막 메시지를 삭제하고 재생성합니다.', triggerCacheBustRegeneration)
                };
                actions[$(this).attr('id')]?.();
            }
        };

        for (const selector in eventMap) {
            $(document).off('click', selector).on('click', selector, eventMap[selector]);
        }

        $(document).off('keypress', '#copybot_start, #copybot_end').on('keypress', '#copybot_start, #copybot_end', (e) => { if(e.which === 13) $('#copybot_execute').click(); });
        $(document).off('keypress', '#copybot_jump_number').on('keypress', '#copybot_jump_number', (e) => { if(e.which === 13) $('#copybot_jump_to').click(); });
        
        $(document).off('input', '#copybot_textbox').on('input', '#copybot_textbox', function() {
            const hasContent = $(this).val().trim().length > 0;
            $('#copybot_copy_content, #copybot_remove_tags, #copybot_linebreak_fix, #copybot_save_txt').prop('disabled', !hasContent);
        });

        $(document).off('change', '.copybot_checkbox, .copybot_radio').on('change', '.copybot_checkbox, .copybot_radio', () => {
            updateActionButtons();
            updateInputFieldIcons();
            saveSettings();
        });
        
        $(document).off('input', '#copybot_ghostwrite_textbox').on('input', saveSettings);
        $(document).off('click', '#copybot_settings_panel, #copybot_ghostwrite_panel').on('click', (e) => e.stopPropagation());

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
                
                setTimeout(() => {
                    loadSettings();
                    updateActionButtons();
                    updateInputFieldIcons();
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
            setTimeout(() => { if (!isInitialized) initialize(); updateInputFieldIcons(); }, 500);
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