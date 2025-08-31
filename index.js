// 깡갤 복사기 확장프로그램
// SillyTavern용 자동 메시지 복사 도구

(function() {
        'use strict';

    console.log('🔥 깡갤 복사기: 스크립트 로드 시작!');

    let isInitialized = false;
	let isPresetEditMode = false; // 대필 프리셋 편집 추적 변수
    const hqProfileCache = new Map(); // 고화질 프로필 캐시용 '메모장'
	
    let isDebugMode = false;
	
	// 대필 진행 상태를 추적하는 변수들
    let isGhostwritingActive = false;
    let ghostwriteOriginalProfile = null;

    // 디버그 로그 전용 함수
    function debugLog(...args) {
        if (isDebugMode) {
            console.log('🐞 깡갤 복사기:', ...args);
        }
    }

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
    
    // 마지막 메시지 번호를 구하는 함수
    function getLastMessageIndex() {
        try {
            const context = window.SillyTavern.getContext();
            if (!context || !context.chat || context.chat.length === 0) {
                console.warn('깡갤 복사기: 대화 기록이 없습니다.');
                return 0;
            }
            
            // 마지막 메시지의 인덱스 (0부터 시작하므로 length - 1)
            const lastIndex = context.chat.length - 1;
            debugLog(`깡갤 복사기: 마지막 메시지 번호 계산됨: ${lastIndex}`);
            return lastIndex;
        } catch (error) {
            console.error('깡갤 복사기: 마지막 메시지 번호 계산 실패', error);
            return 0;
        }
    }
    
    // 고화질 프로필 사진 기능
    let hqProfileObserver = null;
    
    // 입력창 조절점 제거 기능
    let resizeStyleElement = null;
    
    function removeResizeHandle() {
        debugLog('깡갤 복사기: 입력창 및 임시 대필칸 조절점 제거');
        
        const textarea = document.querySelector('#send_textarea');
        const tempPrompt = document.querySelector('#copybot_temp_prompt'); // 임시 대필칸 선택
        
        if (textarea) {
            textarea.style.setProperty('resize', 'none', 'important');
        }
        // 추가된 부분: 임시 대필칸에도 직접 스타일 적용
        if (tempPrompt) {
            tempPrompt.style.setProperty('resize', 'none', 'important');
        }
        
        // 기존 스타일 제거
        if (resizeStyleElement) {
            resizeStyleElement.remove();
        }
        
        // CSS 스타일 추가 (규칙에 #copybot_temp_prompt 추가)
        resizeStyleElement = document.createElement('style');
        resizeStyleElement.textContent = `
            #send_textarea.mdHotkeys,
            #copybot_temp_prompt {
                resize: none !important;
            }
            
            /* 웹킷 브라우저의 resize handle 완전 제거 */
            #send_textarea::-webkit-resizer,
            #copybot_temp_prompt::-webkit-resizer {
                display: none !important;
            }
        `;
        document.head.appendChild(resizeStyleElement);
    }

    
    function restoreResizeHandle() {
        debugLog('깡갤 복사기: 입력창 및 임시 대필칸 조절점 복원');
        
        const textarea = document.querySelector('#send_textarea');
        const tempPrompt = document.querySelector('#copybot_temp_prompt'); // 임시 대필칸 선택
        
        if (textarea) {
            // JavaScript 스타일 제거
            textarea.style.removeProperty('resize');
        }
        // 추가된 부분: 임시 대필칸의 스타일도 제거
        if (tempPrompt) {
            tempPrompt.style.removeProperty('resize');
        }
        
        // CSS 스타일 제거
        if (resizeStyleElement) {
            resizeStyleElement.remove();
            resizeStyleElement = null;
        }
    }

    
    function enableHighQualityProfiles() {
        debugLog('깡갤 복사기: 고화질 프로필 사진 활성화');
        
        // 기존 이미지 처리
        processExistingImages();
        
        // 새로 추가되는 이미지 감시
        if (hqProfileObserver) {
            hqProfileObserver.disconnect();
        }
        
        hqProfileObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        processNewImages(node);
                    }
                });
            });
        });
        
        hqProfileObserver.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }
    
    function disableHighQualityProfiles() {
        debugLog('깡갤 복사기: 고화질 프로필 사진 비활성화');
        
        if (hqProfileObserver) {
            hqProfileObserver.disconnect();
            hqProfileObserver = null;
        }
        
        // 페이지 새로고침으로 원래 썸네일 복원
        // location.reload();
    }
    
    function processExistingImages() {
        document.querySelectorAll('img').forEach(img => {
            convertToHighQuality(img);
        });
    }
    
    function processNewImages(node) {
        if (node.tagName === 'IMG') {
            convertToHighQuality(node);
        } else if (node.querySelectorAll) {
            node.querySelectorAll('img').forEach(img => {
                convertToHighQuality(img);
            });
        }
    }
    
        function convertToHighQuality(img) {
        const originalSrc = img.src;

        // 1. 캐시(메모장)를 먼저 확인합니다.
        if (hqProfileCache.has(originalSrc)) {
            const cachedSrc = hqProfileCache.get(originalSrc);
            if (cachedSrc) { // 캐시에 유효한 URL이 있으면 즉시 교체
                img.src = cachedSrc;
            }
            // 캐시에 'false'가 있다면 (원본이 없는 것으로 확인된 경우), 아무것도 하지 않고 종료.
            return;
        }

        let newSrc = null;

		// 현재 SillyTavern 서버 주소를 동적으로 감지
		const serverBaseUrl = `${window.location.protocol}//${window.location.host}`;

        // 페르소나 썸네일 처리
        if (originalSrc.includes('/thumbnail?type=persona&file=')) {
            const fileName = originalSrc.split('file=')[1];
            newSrc = `http://127.0.0.1:59927/User%20Avatars/${fileName}`;
        }
        // 아바타 썸네일 처리
        else if (originalSrc.includes('/thumbnail?type=avatar&file=')) {
            const fileName = originalSrc.split('file=')[1];
            const decodedFileName = decodeURIComponent(fileName);
            const characterName = decodedFileName.replace('.png', '').replace('.jpg', '').replace('.webp', '');
            newSrc = `http://127.0.0.1:59927/characters/${characterName}/${decodedFileName}`;
        }

        if (newSrc) {
            // 2. 캐시에 결과가 없으면, 네트워크 확인을 진행합니다. (이 과정은 이제 썸네일당 한 번만 실행됩니다)
            const testImg = new Image();
            testImg.onload = function() {
                img.src = newSrc;
                hqProfileCache.set(originalSrc, newSrc); // 3. 성공 결과를 캐시(메모장)에 저장
                debugLog(`[캐시 저장] 고화질 교체 성공: ${newSrc}`);
            };
            testImg.onerror = function() {
                hqProfileCache.set(originalSrc, false); // 3. 실패 결과를 캐시(메모장)에 저장
                debugLog(`[캐시 저장] 원본 이미지 없음: ${originalSrc}`);
            };
            testImg.src = newSrc;
        }
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
                        
                        <small>메세지 범위 입력 후 단순 복사 버튼을 클릭하면 클립보드에 자동 복사&아래 텍스트박스에 해당 내용이 삽입됩니다. 미입력시 자동으로 첫번쨰 메세지/마지막 메세지로 설정됩니다.</small>
                    </div>
                    
                    <!-- 결과 섹션 -->
                    <div class="copybot_section">
                        <textarea id="copybot_textbox" placeholder="복사된 내용이 여기에 표시됩니다..."></textarea>
                        
                        <div class="copybot_textbox_buttons">
                            <button id="copybot_remove_tags" class="copybot_textbox_button" title="텍스트박스에서 태그 제거" disabled>
                                태그 제거
                            </button>
                            <button id="copybot_linebreak_fix" class="copybot_textbox_button copybot_linebreak_button" title="텍스트박스에서 줄바꿈 정리" disabled>
                                정리
                            </button>
                            <button id="copybot_copy_content" class="copybot_textbox_button" title="현재 텍스트박스 내용을 클립보드에 복사" disabled>
                                위 내용 복사
                            </button>
                            <button id="copybot_clear_content" class="copybot_textbox_button copybot_clear_button" title="텍스트박스 내용 전체 삭제" disabled>
                                비우기
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
                                <button id="copybot_open_misc_button" class="copybot_settings_button" title="기타 옵션">
                                    기타
                                </button>
                            </div>
                        </div>

                        <!-- 동적 액션 버튼이 표시될 컨테이너 -->
                        <div id="copybot_action_buttons" class="copybot_action_buttons_row"></div>
                        
                        <!-- 대필 설정창 -->
                        <div id="copybot_ghostwrite_panel" class="copybot_settings_panel" style="display: none;">
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">대필 기능 사용</span>
                                    <button id="copybot_ghostwrite_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                            </div>
                            
                            <div class="copybot_settings_item">
                            <!-- 대필 프롬프트 및 프리셋 섹션 -->

                                <!-- 프리셋 프롬프트 및 프리셋 섹션 -->
								<div id="copybot_preset_row" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
									<!-- 드롭다운과 이름 변경 입력창을 감싸는 래퍼 -->
									<div id="copybot_preset_name_wrapper" style="flex-grow: 1; position: relative;">
										<select id="copybot_preset_select" class="text_pole" style="width: 100%;">
											<option value="">기본 프리셋</option>
											<!-- 자바스크립트로 프리셋 목록이 여기에 추가됩니다 -->
										</select>
										<input type="text" id="copybot_preset_rename_input" class="text_pole" style="width: 100%; display: none;" placeholder="프리셋 이름 입력..."/>
									</div>
									<div id="copybot_preset_buttons" style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
										<!-- 일반 모드 아이콘 -->
										<i id="copybot_preset_save" class="fa-solid fa-save copybot_icon_button" title="현재 프롬프트를 새 프리셋으로 저장"></i>
										<i id="copybot_preset_edit" class="fa-solid fa-edit copybot_icon_button" title="프리셋 편집 모드 시작"></i>
										<!-- 편집 모드 아이콘 (처음에는 숨김) -->
										<i id="copybot_preset_confirm" class="fa-solid fa-check copybot_icon_button" title="변경사항 저장" style="display:none; color: #48bb78;"></i>
										<i id="copybot_preset_delete" class="fa-solid fa-trash-alt copybot_icon_button" title="선택한 프리셋 삭제" style="display:none; color: #e53e3e;"></i>
										<i id="copybot_preset_cancel" class="fa-solid fa-times copybot_icon_button" title="편집 취소" style="display:none;"></i>
									</div>
								</div>

								<!-- 대필 프롬프트 영역 전체 컨테이너 -->
								<div id="copybot_prompt_container">
									<!-- "대필 프롬프트" 라벨 -->
									<div class="copybot_settings_main" style="margin-bottom: 8px;">
										<span class="copybot_settings_label">대필 프롬프트</span>
									</div>
									
									<!-- 대필 프롬프트 텍스트박스 -->
									<textarea id="copybot_ghostwrite_textbox" placeholder="5문장 이하로, 정중한 말투, 1인칭, NSFW 등..." class="copybot_ghostwrite_text" style="display: block;"></textarea>
									
									<!-- 대필 제외 프롬프트 컨테이너 -->
									<div id="copybot_ghostwrite_exclude_container" style="display: block; margin-top: 12px;">
										<div class="copybot_settings_main">
											<span class="copybot_settings_label">대필 제외 프롬프트</span>
										</div>
										<textarea id="copybot_ghostwrite_exclude_textbox" placeholder="웃음, 다정한 말투, 질문하지 않기, 존댓말 금지, 한남 말투 등..." class="copybot_ghostwrite_text" style="margin-top: 8px;"></textarea>
									</div>
									
									<!-- 프리셋 순서 변경 UI - 프롬프트 컨테이너 내부로 이동 -->
									<div id="copybot_reorder_overlay" style="display: none;">
										<div id="copybot_reorder_panel">
											<h5>프리셋 순서 변경</h5>
											<small>항목을 드래그하여 순서를 변경하세요.</small>
											<ul id="copybot_reorder_list">
												<!-- JS로 프리셋 목록이 채워집니다 -->
											</ul>
											<div id="copybot_reorder_buttons">
												<button id="copybot_reorder_save" class="copybot_textbox_button">저장</button>
												<button id="copybot_reorder_cancel" class="copybot_textbox_button copybot_clear_button">취소</button>
											</div>
										</div>
									</div>
								</div>
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
                                    대필 아이콘(<i class="fa-solid fa-user-edit"></i>)을 누르면, 위에 써진 내용(프롬프트)와 채팅창에 적힌 대필 지시문의 내용을 조합하여 사용자를 대신해 봇이 글을 써줍니다. (비어있는 곳은 알아서 무시합니다)
                                </div>
                            </div>
                            
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">임시 대필칸 사용</span>
                                    <button id="copybot_temp_field_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                                <div class="copybot_description" style="margin-top: 10px; font-size:12px; color: #666;">
                                    체크하면 대필 전용칸이 생기고 기본 입력창 내용은 무시됩니다.<br>
                                    체크 해제시 기본 입력창에 쓴 내용을 대필 지시문으로 사용합니다.
                                </div>
                            </div>
                            
                            <!-- [새로 추가될 UI] 대필 전용 프로필 설정 -->
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">대필 전용 프로필</span>
                                    <select id="copybot_ghostwrite_profile_select" class="text_pole" style="max-width: 150px;">
                                        <option value="default">기본값 사용</option>
                                        <!-- 프로필 목록은 나중에 자바스크립트로 채워집니다 -->
                                    </select>
									<!-- 프로필 목록 새로고침 버튼 -->
									<span id="copybot_reload_profiles_button" title="프로필 목록 새로고침" class="fa-solid fa-sync-alt" style="margin-left: 8px; cursor: pointer; opacity: 0.7;"></span>
                                </div>
                                <div class="copybot_description" style="margin-top: 10px; font-size:12px; color: #666;">
                                    대필 기능을 사용할 때만 일시적으로 전환할 API 프로필을 선택합니다.<br>
                                    '기본값 사용'으로 두면 현재 연결된 프로필을 그대로 사용합니다.
                                </div>
								<div class="copybot_description" style="margin-top: 5px; font-size: 11px; color: #ff4d4d; font-weight: bold;">
                                    * 실험적인 기능입니다.
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
                        
                        <!-- 기타 설정창 -->
                        <div id="copybot_misc_panel" class="copybot_settings_panel" style="display: none;">
                            
                        <!-- 다중 메시지 삭제 섹션 -->
                        <div class="copybot_settings_item">
                            <div class="copybot_settings_main">
                                <span class="copybot_settings_label">다중 메세지삭제</span>
                            </div>
                            <div class="copybot_input_row" style="margin-top: 8px; align-items: center;">
                                <div class="copybot_input_group">
                                    <label for="copybot_multi_delete_start">시작 위치:</label>
                                    <input type="number" id="copybot_multi_delete_start" placeholder="0" min="0" class="text_pole">
                                </div>
                                <div class="copybot_input_group">
                                    <label for="copybot_multi_delete_end">종료 위치:</label>
                                    <input type="number" id="copybot_multi_delete_end" placeholder="10" min="0" class="text_pole">
                                </div>
                                <button id="copybot_multi_delete_execute" class="menu_button">삭제</button>
                            </div>
                            <div class="copybot_description" style="margin-top: 10px; font-size:12px; color: #666;">
                                지정된 범위의 메시지를 영구적으로 삭제합니다.<br><strong>실행 전 반드시 백업하세요.</strong>
                            </div>
                        </div>							
							
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">고화질 프로필 사진</span>
                                    <button id="copybot_hq_profile_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                                <div class="copybot_description" style="margin-top: 10px; font-size:12px; color: #666;">
                                    프로필 사진을 고화질로 표시합니다.<br><small>이 옵션을 이용하는 것보다 SillyTavern의 <code>config.yaml</code> 파일에서 <code>thumbnails</code> 섹션의 <code>enabled</code> 값을 <code>true</code>에서 <code>false</code>로 변경하는 게 여러모로 훨씬 좋습니다. 파일 수정이 어려운 이용자를 위한 옵션입니다. 구형 기기를 사용할 경우 페이지 로딩 후 몇 초간 기니피그 한마리만큼의 성능 저하가 발생하며, 그 이후로는 햄스터 꼬리털 세포만큼의 성능 저하가 있습니다.</small>
                                </div>
                            </div>
                            
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">입력창에 조절점 없애기</span>
                                    <button id="copybot_remove_resize_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                                                                <div class="copybot_description" style="margin-top: 10px; font-size:12px; color: #666;">
                                    채팅 입력창의 크기 조절 핸들을 제거합니다.
                                </div>
                            </div>
						
                            <div class="copybot_settings_item">
                                <div class="copybot_settings_main">
                                    <span class="copybot_settings_label">디버그 모드</span>
                                    <button id="copybot_debug_mode_toggle" class="copybot_toggle_button" data-enabled="false">
                                        OFF
                                    </button>
                                </div>
                                <div class="copybot_description" style="margin-top: 10px; font-size:12px; color: #666;">
                                    문제 해결을 위해 콘솔에 자세한 로그를 출력합니다. 이게 뭔지 모른다면 키지마세요! 근데 켜도 크게 상관은 없습니다. 개미 더듬이 세포 하나만큼의 성능 저하가 발생합니다.
                                </div>
								<div id="copybot_debug_info" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e9ecef; font-size: 11px; color: #6c757d; line-height: 1.6;">
                                    <div style="margin: 0 0 4px 0;">SillyTavern release 1.13.3 기준으로 작업되었음.</div>
<div>깃헙링크: <a href="https://github.com/Unknown-7069/ggang-copy-test" target="_blank" rel="noopener noreferrer" style="color: #4299e1; text-decoration: none;">https://github.com/Unknown-7069/ggang-copy-test</a></div>                            </div>
                            
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // 캐시 우회를 위한 새로운 재생성 함수 (토스트 메시지 제거)
    function triggerCacheBustRegeneration() {
        debugLog('깡갤 복사기: 캐시 우회 재생성 시작...');
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
            debugLog('깡갤 복사기: Nonce가 추가된 임시 메시지로 재생성 요청');

            // 토스트 메시지 제거됨 (중복 방지)
            executeSimpleCommand('/trigger', '', () => {
                setTimeout(() => {
                    const currentChat = window.SillyTavern.getContext().chat;
                    if (currentChat[lastUserMessageIndex] && currentChat[lastUserMessageIndex].mes.includes(nonce)) {
                        currentChat[lastUserMessageIndex].mes = originalMessage;
                        debugLog('깡갤 복사기: 마지막 사용자 메시지를 성공적으로 원상복구했습니다.');
                    }
                }, 1000);
            });

        } catch (error) {
            console.error('깡갤 복사기: 캐시 우회 재생성 중 오류 발생', error);
            toastr.error('캐시 우회 재생성 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
        }
    }

    // 설정 저장 함수 강화
    function saveSettings() {
        try {
            const settings = {
                position: $('input[name="copybot_position"]:checked').val() || 'right',
                ghostwrite: {
                    enabled: $('#copybot_ghostwrite_toggle').attr('data-enabled') === 'true',
                    text: $('#copybot_ghostwrite_textbox').val() || '',
                    excludeText: $('#copybot_ghostwrite_exclude_textbox').val() || '', // 제외 프롬프트 저장
                    position: $('input[name="copybot_ghostwrite_position"]:checked').val() || 'right',
                    useTempField: $('#copybot_temp_field_toggle').attr('data-enabled') === 'true',
                    profile: $('#copybot_ghostwrite_profile_select').val() || 'default' // 대필 프로필 설정 저장
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
                },
                misc: {
                    hqProfile: $('#copybot_hq_profile_toggle').attr('data-enabled') === 'true',
                    removeResize: $('#copybot_remove_resize_toggle').attr('data-enabled') === 'true',
                    debugMode: $('#copybot_debug_mode_toggle').attr('data-enabled') === 'true'
                }

            };
            
            // 다중 백업 저장으로 설정 유지 강화
            localStorage.setItem('copybot_settings', JSON.stringify(settings));
            localStorage.setItem('copybot_settings_backup', JSON.stringify(settings));
            sessionStorage.setItem('copybot_settings_temp', JSON.stringify(settings));
            
            debugLog('설정 저장 완료', settings);
            return true;
        } catch (error) {
            console.error('깡갤 복사기: 설정 저장 실패', error);
            return false;
        }
    }

    // 설정 로드 함수 강화
    function loadSettings() {
        try {
            // 다중 소스에서 설정 복구 시도
            let savedSettings = null;
            
            try {
                savedSettings = localStorage.getItem('copybot_settings');
            } catch (e) {
                console.warn('깡갤 복사기: localStorage에서 설정 로드 실패, 백업에서 시도');
            }
            
            if (!savedSettings) {
                try {
                    savedSettings = localStorage.getItem('copybot_settings_backup');
                } catch (e) {
                    console.warn('깡갤 복사기: 백업에서도 설정 로드 실패, sessionStorage에서 시도');
                }
            }
            
            if (!savedSettings) {
                try {
                    savedSettings = sessionStorage.getItem('copybot_settings_temp');
                } catch (e) {
                    console.warn('깡갤 복사기: sessionStorage에서도 설정 로드 실패');
                }
            }
            
            if (!savedSettings) {
                console.log('깡갤 복사기: 저장된 설정이 없음');
                return;
            }

            const settings = JSON.parse(savedSettings);
            debugLog('깡갤 복사기: 설정 로드 중', settings);

            if (settings.position) {
                $(`input[name="copybot_position"][value="${settings.position}"]`).prop('checked', true);
            }

            if (settings.ghostwrite) {
                const isGhostwriteEnabled = settings.ghostwrite.enabled === true;
                $('#copybot_ghostwrite_toggle').attr('data-enabled', isGhostwriteEnabled).text(isGhostwriteEnabled ? 'ON' : 'OFF');
                $('#copybot_ghostwrite_textbox').val(settings.ghostwrite.text || '');
                $('#copybot_ghostwrite_exclude_textbox').val(settings.ghostwrite.excludeText || ''); // 제외 프롬프트 불러오기
                if (settings.ghostwrite.position) {
                    $(`input[name="copybot_ghostwrite_position"][value="${settings.ghostwrite.position}"]`).prop('checked', true);
                }
                
                // 대필 프로필 설정 로드 (타이밍 개선)
                if (settings.ghostwrite.profile) {
                    setTimeout(() => {
                        $('#copybot_ghostwrite_profile_select').val(settings.ghostwrite.profile);
                        debugLog('저장된 대필 프로필 설정 적용:', settings.ghostwrite.profile);
                    }, 200);
                }
                
                // 임시 대필칸 사용 설정 로드
                const useTempField = settings.ghostwrite.useTempField !== undefined ? settings.ghostwrite.useTempField : false;
                $('#copybot_temp_field_toggle').attr('data-enabled', useTempField).text(useTempField ? 'ON' : 'OFF');
                
                // 토글 상태에 따라 모든 관련 UI를 제어
                const ghostwriteElements = $('#copybot_ghostwrite_position_options, #copybot_ghostwrite_panel .copybot_description, #copybot_ghostwrite_textbox, #copybot_ghostwrite_exclude_container');
                if (isGhostwriteEnabled) {
                    ghostwriteElements.show();
                } else {
                    ghostwriteElements.hide();
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
            
            // 기타 설정 로드
            if (settings.misc) {
                // 각 설정값이 명시적으로 true일 때만 ON으로 설정합니다. (기본값 OFF)
                const hqProfileEnabled = settings.misc.hqProfile === true;
                const removeResizeEnabled = settings.misc.removeResize === true;
                isDebugMode = settings.misc.debugMode === true;

                $('#copybot_hq_profile_toggle').attr('data-enabled', hqProfileEnabled).text(hqProfileEnabled ? 'ON' : 'OFF');
                $('#copybot_remove_resize_toggle').attr('data-enabled', removeResizeEnabled).text(removeResizeEnabled ? 'ON' : 'OFF');
                $('#copybot_debug_mode_toggle').attr('data-enabled', isDebugMode).text(isDebugMode ? 'ON' : 'OFF');

				if (isDebugMode) {
					$('#copybot_debug_info').show();
				} else {
					$('#copybot_debug_info').hide();
				}

                // 고화질 프로필 설정 적용
                if (hqProfileEnabled) {
                    enableHighQualityProfiles();
                } else {
                    disableHighQualityProfiles();
                }
                
                // 입력창 조절점 제거 설정 적용
                if (removeResizeEnabled) {
                    removeResizeHandle();
                }
            }

            debugLog('깡갤 복사기: 설정 로드 완료');
        } catch (error) {
            console.error('깡갤 복사기: 설정 로드 실패', error);
        }
    }
    
    // 임시 프롬프트 창 스타일 업데이트 함수
    function updateTempPromptStyle() {
        try {
            const tempPromptInput = document.querySelector('#copybot_temp_prompt');
            const sendTextarea = document.querySelector('#send_textarea');
            
            if (!tempPromptInput || !sendTextarea) return;
            
            // send_textarea의 최신 스타일 가져오기
            const originalStyles = window.getComputedStyle(sendTextarea);
            tempPromptInput.style.cssText = `
                width: 100%;
                border: ${originalStyles.border};
                border-top: none;
                border-radius: 0 0 5px 5px;
                background: ${originalStyles.backgroundColor};
                color: ${originalStyles.color};
                font-family: ${originalStyles.fontFamily};
                font-size: ${originalStyles.fontSize};
                padding: ${originalStyles.padding};
                resize: vertical;
                min-height: 35px;
                max-height: 100px;
                box-sizing: border-box;
                outline: none;
                margin: 0;
            `;
            
            debugLog('깡갤 복사기: 임시 프롬프트 창 스타일 업데이트 완료');
        } catch (error) {
            console.error('깡갤 복사기: 임시 프롬프트 창 스타일 업데이트 실패', error);
        }
    }
    
    // 대필 임시 프롬프트 입력칸을 채팅 입력창 바로 아래에 붙여서 추가하는 함수
    function addTempPromptField() {
        try {
            debugLog('깡갤 복사기: 임시 프롬프트 입력칸 추가 시작');
            
            // 대필기능과 임시 대필칸 사용 설정 확인
            const ghostwriteEnabled = $('#copybot_ghostwrite_toggle').attr('data-enabled') === 'true';
            const useTempField = $('#copybot_temp_field_toggle').attr('data-enabled') === 'true';
            
            // 기존 임시 프롬프트 제거
            document.querySelectorAll('.copybot_temp_prompt_below').forEach(el => el.remove());
            
            // 대필기능이 꺼져있거나 임시 대필칸 사용이 꺼져있으면 종료
            if (!ghostwriteEnabled || !useTempField) {
                debugLog('깡갤 복사기: 대필기능 꺼짐 또는 임시 대필칸 사용 안함 - 건너뜀');
                return;
            }
            
            const sendTextarea = document.querySelector('#send_textarea');
            if (!sendTextarea) {
                debugLog('깡갤 복사기: send_textarea를 찾을 수 없음');
                return;
            }

            // send_textarea의 부모와 조부모 찾기
            const textareaParent = sendTextarea.parentElement; // nonQRFormItems
            const grandParent = textareaParent.parentElement; // send_form
            
            if (!grandParent) {
                debugLog('깡갤 복사기: send_form을 찾을 수 없음');
                return;
            }

            // 임시 대필칸 생성 (완전히 새로운 컨테이너로)
            const tempPromptContainer = document.createElement('div');
            tempPromptContainer.className = 'copybot_temp_prompt_below';
            tempPromptContainer.style.cssText = `
                width: 100%;
                margin: 0;
                padding: 0;
                order: 999;
            `;
            
            const tempPromptInput = document.createElement('textarea');
            tempPromptInput.id = 'copybot_temp_prompt';
            tempPromptInput.placeholder = '대필 임시 지시문...';
            tempPromptInput.rows = 1;
            
            // send_textarea와 같은 스타일 복사
            const originalStyles = window.getComputedStyle(sendTextarea);
            tempPromptInput.style.cssText = `
                width: 100%;
                border: ${originalStyles.border};
                border-top: none;
                border-radius: 0 0 5px 5px;
                background: ${originalStyles.backgroundColor};
                color: ${originalStyles.color};
                font-family: ${originalStyles.fontFamily};
                font-size: ${originalStyles.fontSize};
                padding: ${originalStyles.padding};
                resize: vertical;
                min-height: 35px;
                max-height: 100px;
                box-sizing: border-box;
                outline: none;
                margin: 0;
            `;

            // 자동 높이 조절 기능 추가
            const autoResize = () => {
                tempPromptInput.style.height = 'auto';
                const scrollHeight = tempPromptInput.scrollHeight;
                const maxHeight = 100; // 최대 높이 제한
                const minHeight = 35; // 최소 높이
                
                if (scrollHeight > maxHeight) {
                    tempPromptInput.style.height = maxHeight + 'px';
                    tempPromptInput.style.overflowY = 'auto';
                } else {
                    tempPromptInput.style.height = Math.max(scrollHeight, minHeight) + 'px';
                    tempPromptInput.style.overflowY = 'hidden';
                }
            };

            // 입력 시 자동 저장 및 높이 조절
            tempPromptInput.addEventListener('input', () => {
                autoResize();
                saveTempPrompt();
            });

            // 초기 높이 설정
            setTimeout(autoResize, 100);
            
            tempPromptContainer.appendChild(tempPromptInput);
            
            // send_textarea의 border-radius 수정 (연결된 느낌)
            sendTextarea.style.borderRadius = '5px 5px 0 0';
            
            // 안전한 방법: send_form의 맨 마지막에 추가 (기존 레이아웃 건드리지 않음)
            grandParent.appendChild(tempPromptContainer);

            debugLog('깡갤 복사기: 임시 프롬프트 입력칸 추가 완료');

        } catch (error) {
            console.error('깡갤 복사기: 임시 프롬프트 입력칸 추가 실패', error);
        }
    }

        // **간단한 최우선순위 방식: 100% 안전한 대필 실행 함수 (사용자 설정 건드리지 않음 + 토큰 절약)**
    async function executeGhostwrite() {
        let originalProfile = null;
        let profileChangeAttempted = false;
		
		const sendButton = document.querySelector('#send_but');
		const sendIcon = sendButton ? sendButton.querySelector('i.fa-solid') : null;
		
		const rightSendForm = document.querySelector('#rightSendForm');		

        try {
            isGhostwritingActive = true;
            ghostwriteOriginalProfile = null;

            const promptText = ($('#copybot_ghostwrite_textbox').val() || '').trim();
            const excludeText = ($('#copybot_ghostwrite_exclude_textbox').val() || '').trim();
            const useTempField = $('#copybot_temp_field_toggle').attr('data-enabled') === 'true';
            
            let finalPrompt = '';

            if (useTempField) {
                const tempPromptText = ($('#copybot_temp_prompt').val() || '').trim();
                const parts = [];
                if (promptText) parts.push(promptText);
                if (tempPromptText) parts.push(tempPromptText);
                finalPrompt = parts.join(', ');
            } else {
                const chatInputText = ($('#send_textarea').val() || '').trim();
                const parts = [];
                if (promptText) parts.push(promptText);
                if (chatInputText) parts.push(chatInputText);
                finalPrompt = parts.join(', ');
            }

            let requestMessage = finalPrompt.trim() ? `"${finalPrompt.substring(0, 100)}..."로 대필 요청합니다.` : '빈 프롬프트로 대필 요청합니다.';
            toastr.info(requestMessage);

            debugLog('🎭 깡갤 복사기: 대필 시작');
			
            if (rightSendForm) {
                const formWidth = rightSendForm.getBoundingClientRect().width;
                if (formWidth > 0) {
                    rightSendForm.style.minWidth = `${formWidth}px`;
                }
            }
            if (sendButton && sendIcon) {
                sendButton.disabled = true;
                sendIcon.style.display = 'none';
                const spinner = document.createElement('i');
                spinner.className = 'fa-solid fa-spinner fa-spin';
                spinner.style.fontSize = window.getComputedStyle(sendIcon).fontSize;
                spinner.style.color = window.getComputedStyle(sendIcon).color;
                sendButton.appendChild(spinner);
            }

            const selectedProfile = $('#copybot_ghostwrite_profile_select').val();
			const selectedProfileName = $('#copybot_ghostwrite_profile_select option:selected').text(); // 선택된 옵션의 '이름'을 가져옵니다.

            if (selectedProfile && selectedProfile !== 'default') {
                const connectionDropdown = document.querySelector('#connection_profiles');
                if (connectionDropdown) {
                    originalProfile = connectionDropdown.value;
                    ghostwriteOriginalProfile = originalProfile; 

                    if (originalProfile !== selectedProfile) {
                        profileChangeAttempted = true;
                        await switchProfile(selectedProfile);
                        if (isDebugMode) {
                            toastr.success(`대필 전용 프로필 '${selectedProfileName}'로 전환되었습니다.`);
                        }
                    }
                }
            }

            if (!isGhostwritingActive) {
                throw new Error('User cancelled during profile switch.');
            }
            
            const context = window.SillyTavern.getContext();

            if (!context || !context.generateQuietPrompt) {
                toastr.error('SillyTavern 컨텍스트를 찾을 수 없습니다.');
                return;
            }

            let exclusionInstruction = excludeText ? `\n[Exclusion Instructions]\nCRITICAL: The following elements must be completely avoided in the response. Do not use these words, phrases, tones, or concepts:\n${excludeText}\n` : '';

            const overridePrompt = finalPrompt.trim() ? `<OVERRIDE>
				Apply the following instructions with priority over existing settings:
				1. Write only {{user}}'s reactions and responses
				2. Follow {{user}}'s character settings and personality
				3. Do not use system messages
				4. Do not repeat or quote sentences or expressions from previous responses
				5. Use appropriate paragraph breaks, but merge consecutive dialogue without actions or descriptions into single sentences
				6. Before writing, briefly recall {{user}}'s established personality, speech patterns, and their relationship with the other character to ensure perfect consistency.
				7. Prioritize weaving the character's emotions and intentions into their 'dialogue'. Use action descriptions (narration) to describe the atmosphere or specific situations that are difficult to convey with dialogue alone, seeking a natural harmony between the two.
				${exclusionInstruction}
				[User's Core Intent]
				The following is the user's core intent, possibly written as a brief memo or keyword. Interpret this intent, expand upon it, and express it as natural dialogue and actions from {{user}}'s perspective.
				Core Intent: ${finalPrompt}
				</OVERRIDE>` : `<OVERRIDE>
				Apply the following instructions with priority over existing settings:
				1. Write only {{user}}'s reactions and responses
				2. Follow {{user}}'s character settings and personality
				3. Do not use system messages
				4. Do not repeat or quote sentences or expressions from previous responses
				5. Use appropriate paragraph breaks, but merge consecutive dialogue without actions or descriptions into single sentences
				6. Before writing, briefly recall {{user}}'s established personality, speech patterns, and their relationship with the other character to ensure perfect consistency.
				7. Prioritize weaving the character's emotions and intentions into their 'dialogue'. Use action descriptions (narration) to describe the atmosphere or specific situations that are difficult to convey with dialogue alone, seeking a natural harmony between the two.
				${exclusionInstruction}
				</OVERRIDE>`;
            
            debugLog('🔹 AI에 전송할 최종 명령어:', overridePrompt);

            let result;
            const maxRetries = 3;
            const retryDelay = 1500;

            for (let i = 0; i < maxRetries; i++) {
                if (!isGhostwritingActive) {
                    // isGhostwritingActive가 false이면, 에러를 던져서 for 루프를 즉시 탈출
                    throw new Error('User cancelled before API call.');
                }
                try {
                    debugLog(`대필 요청 시도 (${i + 1}/${maxRetries})...`);
                    result = await context.generateQuietPrompt(overridePrompt, false, true);
                    debugLog('✅ 대필 요청 성공!');
                    break; // 성공하면 루프 탈출
                } catch (error) {
                    const errorMessage = String(error);
                    console.warn(`대필 시도 ${i + 1} 실패:`, errorMessage);

                    // [핵심 수정] 사용자가 중단한 경우, 재시도하지 않고 즉시 루프를 빠져나감
                    if (!isGhostwritingActive || errorMessage.includes('Clicked stop button')) {
                        throw error; // 에러를 상위 catch 블록으로 던져서 루프를 완전히 중단
                    }

                    if (i === maxRetries - 1) {
                        throw error;
                    }
                    debugLog(`${retryDelay}ms 후 재시도...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }

            debugLog('✅ 대필 원본 결과 받음:', result);

            let cleanedResult = result;
            if (cleanedResult) {
                cleanedResult = cleanedResult.replace(/<OVERRIDE>|제목:|주제:/gi, '').replace(/<\/OVERRIDE>/gi, '').replace(/\{\{user\}\} POV only[^\n]*/gi, '').replace(/<Override Primary Directive>/gi, '').replace(/<CRITICAL_SYSTEM_OVERRIDE>/gi, '').replace(/\[System Override[^\]]*\]/gi, '').replace(/^\s*\n+/, '').trim();
                debugLog('🧹 정리된 대필 결과:', cleanedResult);
                if (cleanedResult.trim()) {
                    $('#send_textarea').val(cleanedResult).trigger('input');
                    debugLog('깡갤 복사기: 대필 결과 입력창 삽입 완료');
                } else {
                    toastr.warning('대필 결과가 비어있습니다. 다시 시도해주세요.');
                }
            } else if (isGhostwritingActive) {
                toastr.warning('대필 결과를 받지 못했습니다. 다시 시도해주세요.');
            }
            
            if (useTempField) saveTempPrompt();

        } catch (error) {
            const errorString = String(error);
            
            if (errorString.includes('User cancelled') || errorString.includes('Clicked stop button')) {
                debugLog('🚫 깡갤 복사기: 대필 작업이 사용자에 의해 중단되었습니다.');
                toastr.info('대필 요청이 중단되었습니다.');
            } else {
                console.error('깡갤 복사기: 대필 실행 중 최종 오류', error);
                toastr.error('대필에 최종적으로 실패했습니다. 콘솔을 확인해주세요.');
            }
        } finally {
            if (profileChangeAttempted && originalProfile) {
				try {
					debugLog(`프로필 원복 시도: ${originalProfile}`);
					await switchProfile(originalProfile, true); // 프로필 원복 시도
					
					// 원복 성공 메시지는 디버그 모드에서만 표시
					const originalProfileName = $(`#connection_profiles option[value="${originalProfile}"]`).text(); // 원래 프로필의 '이름'을 찾아서 가져옵니다.
					if (isDebugMode) {
						toastr.success(`원래 프로필 '${originalProfileName}'로 복원되었습니다.`);
					}
				} catch (restoreError) {
					// 만약 위에서 프로필 원복 시도가 실패하면 여기가 실행됩니다.
					console.error('!!! 치명적 오류: 프로필 원복에 실패했습니다 !!!', restoreError);
					toastr.error('프로필이 원래대로 복원되지 않았습니다! 수동으로 확인해주세요.');
				}
			}

			
			if (rightSendForm) {
                rightSendForm.style.minWidth = '';
            }

            isGhostwritingActive = false;
            ghostwriteOriginalProfile = null;
            
            if (sendButton) {
                sendButton.disabled = false;
                const spinner = sendButton.querySelector('i.fa-spinner');
                if (spinner) spinner.remove();
                if (sendIcon) sendIcon.style.display = '';
            }

        }
    }



    // 임시 프롬프트 저장 함수
    function saveTempPrompt() {
        try {
            const tempPrompt = $('#copybot_temp_prompt').val();
            sessionStorage.setItem('copybot_temp_prompt', tempPrompt);
        } catch (error) {
            console.warn('깡갤 복사기: 임시 프롬프트 저장 실패', error);
        }
    }

    // 임시 프롬프트 로드 함수
    function loadTempPrompt() {
        try {
            const savedTempPrompt = sessionStorage.getItem('copybot_temp_prompt');
            if (savedTempPrompt) {
                $('#copybot_temp_prompt').val(savedTempPrompt);
            }
        } catch (error) {
            console.warn('깡갤 복사기: 임시 프롬프트 로드 실패', error);
        }
    }

    // 단순 명령어를 실행하는 범용 함수
    async function executeSimpleCommand(command, successMessage, callback, isGhostwriting = false) {
        try {
            debugLog(`깡갤 복사기: 실행 중인 명령어 - ${command}`);
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
                        // input 이벤트를 강제로 발생시켜 모든 버튼 상태를 올바르게 업데이트합니다.
                        $('#copybot_textbox').trigger('input');
                        debugLog('텍스트박스에 내용 표시 완료');
                    }
                } catch (error) {
                    debugLog('클립보드 읽기 실패 (권한 문제일 수 있음)', error);
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
            debugLog('깡갤 복사기: 텍스트박스 내용 클립보드 복사 완료');
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
                debugLog('깡갤 복사기: fallback 방법으로 클립보드 복사 완료');
            } catch (fallbackError) {
                console.error('깡갤 복사기: fallback 복사도 실패', fallbackError);
                toastr.error('클립보드 복사에 실패했습니다.');
            }
        }
    }

    // 특정 element에서 태그를 제거하는 범용 함수 ({{ }} 템플릿 구문 제거 기능 추가)
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

            debugLog(`깡갤 복사기: ${selector} 태그 제거 시작, 원본 길이:`, currentText.length);

            let cleanedText = currentText;
            let iterationCount = 0;
            const maxIterations = 10;
            
            // HTML 태그 제거
            while (iterationCount < maxIterations) {
                const previousText = cleanedText;
                cleanedText = cleanedText.replace(/<([^>\/\s]+)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g, '');
                iterationCount++;
                if (cleanedText === previousText) break;
            }

            cleanedText = cleanedText.replace(/<[^>]*>/g, '');
            
            // {{ }} 템플릿 구문 제거 추가(에셋)
            cleanedText = cleanedText.replace(/\{\{.*?\}\}/g, '');
            
			// [STATUS_START] ~ [STATUS_END] 상태창 제거(301호)
            cleanedText = cleanedText.replace(/\[STATUS_START\][\s\S]*?\[STATUS_END\]/g, '');

			// 괴담출 상태창 제거 (접속자 정보 ~ :: ~ ::)
            cleanedText = cleanedText.replace(/접속자 정보[\s\S]*?::[^:]*::/g, '');
			
			// 이선우 HUD 제거 (반각/전각 ｜와 ♀️/♂️가 모두 포함된 경우만)
            cleanedText = cleanedText.replace(/\[(?=[\s\S]*?[|｜])(?=[\s\S]*?[♀️♂️])[\s\S]*?\]/g, '');
			
			// OOC 메시지 제거
            // 케이스 2: (OOC:...) 와 그 아래 --- 구분선, 그리고 그 줄바꿈까지 한번에 제거
            cleanedText = cleanedText.replace(/\(OOC\s*:[\s\S]*?\)\s*\n\s*[-_]{3}\s*\n?/gi, '');
            // 케이스 1: (OOC:...) 만 제거 (공백 유연하게 처리)
            cleanedText = cleanedText.replace(/\(OOC\s*:[\s\S]*?\)/gi, '');
			
            cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
            cleanedText = cleanedText.trim();

            debugLog(`깡갤 복사기: 태그 및 템플릿 구문 제거 완료, 최종 길이:`, cleanedText.length);
            targetElement.val(cleanedText);
            targetElement.trigger('input');

            if (cleanedText.length < currentText.length) {
                const removedChars = currentText.length - cleanedText.length;
                toastr.success(`태그 및 템플릿 구문 제거 완료! (${removedChars}자 제거됨)`);
            } else {
                toastr.info('제거할 태그나 템플릿 구문이 없습니다.');
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

    // **강화된 DOM 준비 상태 확인 함수**
    function isInputFieldReady() {
        const rightSendForm = document.querySelector('#rightSendForm');
        const leftSendForm = document.querySelector('#leftSendForm');
        const textarea = document.querySelector('#send_textarea');
        const sendButton = document.querySelector('#send_but');
        
        // 더 엄격한 체크: 모든 요소가 존재하고 실제로 DOM에 연결되어 있는지 확인
        const allElementsExist = !!(rightSendForm && leftSendForm && textarea && sendButton);
        const allElementsConnected = !!(
            rightSendForm && rightSendForm.isConnected &&
            leftSendForm && leftSendForm.isConnected &&
            textarea && textarea.isConnected &&
            sendButton && sendButton.isConnected
        );
        
        // 요소들이 실제로 화면에 렌더링되었는지 확인
        const hasLayout = !!(
            textarea && textarea.offsetParent &&
            rightSendForm && rightSendForm.offsetParent
        );
        
        const isReady = allElementsExist && allElementsConnected && hasLayout;
        
        if (!isReady) {
            debugLog('깡갤 복사기: DOM 준비 상태 체크 실패:', {
                allElementsExist,
                allElementsConnected,
                hasLayout,
                rightSendForm: !!rightSendForm,
                leftSendForm: !!leftSendForm,
                textarea: !!textarea,
                sendButton: !!sendButton
            });
        }
        
        return isReady;
    }

    // **레이아웃 안정화까지 기다리는 함수**
    function waitForLayoutStabilization() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20; // 최대 20번 시도 (10초)
            
            const checkStability = () => {
                attempts++;
                
                if (isInputFieldReady()) {
                    // 추가로 200ms 더 기다려서 레이아웃이 완전히 안정되도록 함
                    setTimeout(() => {
                        if (isInputFieldReady()) {
                            debugLog(`DOM 안정화 완료 (${attempts}번째 시도)`);
                            resolve(true);
                        } else {

                            if (attempts < maxAttempts) {
                                setTimeout(checkStability, 500);
                            } else {
                                debugLog('깡갤 복사기: DOM 안정화 타임아웃');
                                resolve(false);
                            }
                        }
                    }, 200);
                } else {
                    if (attempts < maxAttempts) {
                        setTimeout(checkStability, 500);
                    } else {
                        debugLog('깡갤 복사기: DOM 안정화 실패 - 타임아웃');
                        resolve(false);
                    }
                }
            };
            
            checkStability();
        });
    }

    // **안전한 아이콘 업데이트 함수 (DOM 안정화 대기 포함)**
    async function safeUpdateInputFieldIcons() {
        try {
            debugLog('안전한 아이콘 업데이트 시작...');
            
            // DOM이 안정화될 때까지 기다림
            const isStabilized = await waitForLayoutStabilization();
            
            if (!isStabilized) {
                debugLog('깡갤 복사기: DOM 안정화 실패, 아이콘 업데이트 건너뜀');
                return;
            }
            
            debugLog('DOM 안정화 확인됨, 아이콘 업데이트 진행');
            updateInputFieldIcons();
            
        } catch (error) {
            console.error('깡갤 복사기: 안전한 아이콘 업데이트 실패', error);
        }
    }


    // 통합 아이콘 관리 함수 (로딩 개선)
    function updateInputFieldIcons() {
        try {
            debugLog('아이콘 업데이트 시작');
            
            // 기존 아이콘들 제거

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
            if (!referenceIcon) {
                console.warn('깡갤 복사기: send_but 요소를 찾을 수 없어 아이콘 업데이트 중단');
                return;
            }

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
                    // 매번 최신 테마 스타일 적용
                    const currentStyle = window.getComputedStyle(referenceIcon);
                    icon.style.fontSize = currentStyle.fontSize;
                    icon.style.color = currentStyle.color;
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
                            // 최신 테마 색상 다시 가져오기
                            const currentStyle = window.getComputedStyle(referenceIcon);
                            const currentThemeColor = currentStyle.color;
                            const { r, g, b } = rgbStringToObj(currentThemeColor);
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
                                icon.addEventListener('mouseleave', () => { icon.style.color = currentThemeColor; });
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
            debugLog('아이콘 업데이트 완료');
        } catch (error) {
            console.error('깡갤 복사기: 입력 필드 아이콘 업데이트 실패', error);
        }
    }

		// =======================================================
		// 프리셋 관리 기능 (localStorage 기반) - 수정된 버전
		// =======================================================

		// 유틸리티: HTML 특수문자 처리
		function escapeHtml(str) {
			if (typeof str !== 'string') return '';
			return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		}

		// localStorage에서 프리셋 목록을 가져오는 함수
		function getPresets() {
			try {
				const presetsJSON = localStorage.getItem('copybot_presets');
				return presetsJSON ? JSON.parse(presetsJSON) : [];
			} catch (e) {
				console.error("프리셋 로딩 실패:", e);
				return [];
			}
		}

		// localStorage에 프리셋 목록을 저장하는 함수
		function savePresets(presets) {
			try {
				localStorage.setItem('copybot_presets', JSON.stringify(presets));
			} catch (e) {
				console.error("프리셋 저장 실패:", e);
			}
		}

		// 선택한 프리셋의 내용을 프롬프트 창에 불러오는 함수
		function loadPreset(presetName) {
			if (!presetName) {
				$('#copybot_ghostwrite_textbox').val('');
				$('#copybot_ghostwrite_exclude_textbox').val('');
				return;
			}
			const presets = getPresets();
			const preset = presets.find(p => p.name === presetName);
			if (preset) {
				$('#copybot_ghostwrite_textbox').val(preset.prompt);
				$('#copybot_ghostwrite_exclude_textbox').val(preset.excludePrompt);
			}
		}

		// 현재 프롬프트 내용을 저장하는 함수 (덮어쓰기 또는 새로 저장)
		function saveCurrentPreset() {
			const selectedName = $('#copybot_preset_select').val();
			let presets = getPresets();

			if (selectedName) { // 시나리오 1: 프리셋이 선택되어 있을 때 (업데이트)
				const presetToUpdate = presets.find(p => p.name === selectedName);
				if (presetToUpdate) {
					presetToUpdate.prompt = $('#copybot_ghostwrite_textbox').val();
					presetToUpdate.excludePrompt = $('#copybot_ghostwrite_exclude_textbox').val();
					savePresets(presets);
					toastr.success(`'${escapeHtml(selectedName)}' 프리셋이 업데이트되었습니다.`);
				} else {
					toastr.error(`'${escapeHtml(selectedName)}' 프리셋을 찾지 못해 업데이트에 실패했습니다.`);
				}
			} else { // 시나리오 2: "프리셋 없음"일 때 (새로 저장)
				let name = prompt("저장할 새 프리셋의 이름을 입력하세요:", "");
				if (!name || name.trim() === '') {
					if (name !== null) toastr.warning("프리셋 이름은 비워둘 수 없습니다.");
					return;
				}
				name = name.trim();
				const existingPreset = presets.find(p => p.name.toLowerCase() === name.toLowerCase());
				if (existingPreset) {
					if (!confirm(`'${existingPreset.name}' 프리셋이 이미 존재합니다. 덮어쓰시겠습니까?`)) return;
					existingPreset.prompt = $('#copybot_ghostwrite_textbox').val();
					existingPreset.excludePrompt = $('#copybot_ghostwrite_exclude_textbox').val();
					toastr.success(`'${existingPreset.name}' 프리셋을 덮어썼습니다.`);
				} else {
					presets.push({ name: name, prompt: $('#copybot_ghostwrite_textbox').val(), excludePrompt: $('#copybot_ghostwrite_exclude_textbox').val() });
					toastr.success(`'${name}' 프리셋을 새로 저장했습니다.`);
				}
				savePresets(presets);
				updatePresetDropdown();
				$('#copybot_preset_select').val(name);
			}
		}

		// 프리셋 이름 변경 함수
		function renamePreset(oldName, newName) {
			let presets = getPresets();
			if (presets.some(p => p.name.toLowerCase() === newName.toLowerCase() && p.name.toLowerCase() !== oldName.toLowerCase())) {
				toastr.error(`'${newName}' 이름은 이미 사용 중입니다.`);
				return false;
			}
			const preset = presets.find(p => p.name === oldName);
			if (preset) {
				preset.name = newName;
				savePresets(presets);
				return true;
			}
			return false;
		}

		// 프리셋 삭제 함수
		function deletePreset(nameToDelete) {
			let presets = getPresets();
			savePresets(presets.filter(p => p.name !== nameToDelete));
			loadPreset('');
		}

		// 새 프리셋 추가 함수
		function addNewPreset() {
			let presets = getPresets();
			let newNameBase = "새 프리셋";
			let newName = newNameBase;
			let counter = 1;
			while (presets.some(p => p.name === newName)) {
				newName = `${newNameBase} ${++counter}`;
			}
			presets.push({ name: newName, prompt: "", excludePrompt: "" });
			savePresets(presets);
			updatePresetDropdown();
			$('#copybot_preset_select').val(newName);
			loadPreset(newName);
			enterPresetEditMode();
		}

		// 현재 프리셋을 복사하는 함수
		function copyCurrentPreset() {
			const originalName = $('#copybot_preset_select').val();
			let presets = getPresets();
			
			if (!originalName) {
				// "프리셋 없음" 상태일 때 - 현재 입력된 내용으로 새 프리셋 생성
				const currentPrompt = $('#copybot_ghostwrite_textbox').val();
				const currentExcludePrompt = $('#copybot_ghostwrite_exclude_textbox').val();
				
				let newName = "복사된 프리셋 (1)";
				let counter = 1;
				while (presets.some(p => p.name === newName)) {
					counter++;
					newName = `복사된 프리셋 (${counter})`;
				}
				
				const newPreset = { 
					name: newName, 
					prompt: currentPrompt || '', 
					excludePrompt: currentExcludePrompt || '' 
				};
				// "기본 프리셋" 상태에서는 맨 끝에 추가
				presets.push(newPreset);
				savePresets(presets);
				toastr.success(`현재 입력 내용이 '${escapeHtml(newName)}'으로 저장되었습니다.`);
				updatePresetDropdown();
				$('#copybot_preset_select').val(newName);
				return;
			}
			
			const originalPreset = presets.find(p => p.name === originalName);
			if (!originalPreset) {
				toastr.error("원본 프리셋을 찾을 수 없습니다.");
				return;
			}
			let newName = `${originalName} (1)`;
			let counter = 1;
			while (presets.some(p => p.name === newName)) {
				counter++;
				newName = `${originalName} (${counter})`;
			}
			const newPreset = { name: newName, prompt: originalPreset.prompt, excludePrompt: originalPreset.excludePrompt };
			const originalIndex = presets.findIndex(p => p.name === originalName);
			
			// 원본 프리셋의 바로 다음 위치에 삽입
			if (originalIndex !== -1) {
				presets.splice(originalIndex + 1, 0, newPreset);
			} else {
				// 혹시 원본을 못 찾으면 맨 끝에 추가
				presets.push(newPreset);
			}
			
			savePresets(presets);
			toastr.success(`'${escapeHtml(newName)}'으로 복사되었습니다.`);
			updatePresetDropdown();
			$('#copybot_preset_select').val(newName);
		}

		// 프리셋 순서 변경 함수
		function reorderPresets(newOrderNameArray) {
			const presets = getPresets();
			const reorderedPresets = newOrderNameArray.map(name => presets.find(p => p.name === name)).filter(Boolean);
			savePresets(reorderedPresets);
		}

		// --- UI 제어 함수들 ---

		let draggedItem = null;

		// 프리셋 드롭다운을 최신 상태로 업데이트하는 중앙 함수
		function updatePresetDropdown() {
			const presets = getPresets();
			const select = $('#copybot_preset_select');
			const selectedValue = select.val(); // 현재 선택된 값 기억

			// 1. 드롭다운 메뉴를 완전히 새로 구성합니다.
			select.empty();
			select.append('<option value="">기본 프리셋</option>');

			presets.forEach(preset => {
				select.append($('<option>', { value: preset.name, text: escapeHtml(preset.name) }));
			});

			// 2. 관리 메뉴를 항상 추가합니다.
			select.append('<option value="" disabled>──────────</option>');
			select.append('<option value="__add__" class="copybot_preset_management_option">+ 새 프리셋 추가</option>');
			
			// 프리셋이 2개 이상일 때만 순서 변경 기능 표시
			if (presets.length > 1) {
				select.append('<option value="__reorder__" class="copybot_preset_management_option">+ 프리셋 순서 변경</option>');
			}
			
			// "현재 프리셋 복사" 기능을 항상 표시
			select.append('<option value="__copy__" class="copybot_preset_management_option">+ 현재 프리셋 복사</option>');
			
			// 3. 이전에 선택했던 값을 그대로 다시 선택해줍니다.
			select.val(selectedValue);
			
			// 4. 현재 선택된 값을 data 속성에 저장 (관리 메뉴에서 복원용)
			select.data('previousValue', selectedValue);
		}


		// 편집 모드 진입
		function enterPresetEditMode() {
			isPresetEditMode = true;
			const selectedPresetName = $('#copybot_preset_select').val();
			$('#copybot_preset_save, #copybot_preset_edit').hide();
			$('#copybot_preset_confirm, #copybot_preset_cancel').show();
			if (selectedPresetName) $('#copybot_preset_delete').show();
			$('#copybot_preset_select').hide();
			$('#copybot_preset_rename_input').val(selectedPresetName).show().trigger('focus');
			$('#copybot_ghostwrite_textbox, #copybot_ghostwrite_exclude_textbox').prop('disabled', true);
		}
		
		// 프리셋 편집 버튼 상태 업데이트
		function updatePresetEditButtonState() {
			const selectedPreset = $('#copybot_preset_select').val();
			const editButton = $('#copybot_preset_edit');
			
			if (!selectedPreset) {
				// 기본 프리셋 선택 시 편집 버튼 비활성화
				editButton.addClass('disabled').attr('title', '기본 프리셋은 편집할 수 없습니다');
			} else {
				// 다른 프리셋 선택 시 편집 버튼 활성화
				editButton.removeClass('disabled').attr('title', '프리셋 편집 모드 시작');
			}
		}

		// 편집 모드 종료
		function exitPresetEditMode(forceUpdate = false) {
			if (!isPresetEditMode && !forceUpdate) return;
			isPresetEditMode = false;
			$('#copybot_preset_save, #copybot_preset_edit').show();
			$('#copybot_preset_confirm, #copybot_preset_delete, #copybot_preset_cancel').hide();
			$('#copybot_preset_rename_input').hide();
			$('#copybot_preset_select').show();
			$('#copybot_ghostwrite_textbox, #copybot_ghostwrite_exclude_textbox').prop('disabled', false);
			updatePresetDropdown();
		}

		// 순서 변경 인라인 UI 열기
		function openReorderModal() {
			const presets = getPresets();
			const list = $('#copybot_reorder_list').empty();
			presets.forEach((preset, index) => {
				const isFirst = index === 0;
				const isLast = index === presets.length - 1;
				const upButton = isFirst ? '' : '<button class="copybot_move_up" style="margin-right: 5px; padding: 2px 6px; font-size: 12px;">↑</button>';
				const downButton = isLast ? '' : '<button class="copybot_move_down" style="margin-left: 5px; padding: 2px 6px; font-size: 12px;">↓</button>';
				
				const item = $(`<li class="copybot_reorder_item" style="display: flex; align-items: center; justify-content: space-between;">
					<span class="copybot_reorder_name">${escapeHtml(preset.name)}</span>
					<div class="copybot_reorder_buttons">${upButton}${downButton}</div>
				</li>`);
				item.data('presetName', preset.name);
				list.append(item);
			});
			
			// 프롬프트 관련 요소들을 숨기고 순서 변경 UI를 표시
			$('#copybot_prompt_container > .copybot_settings_main, #copybot_ghostwrite_textbox, #copybot_ghostwrite_exclude_container').slideUp(200, function() {
				$('#copybot_reorder_overlay').slideDown(200);
			});
		}

		// 순서 변경 인라인 UI 닫기
		function closeReorderModal() {
			// 순서 변경 UI를 숨기고 프롬프트 관련 요소들을 다시 표시
			$('#copybot_reorder_overlay').slideUp(200, function() {
				$('#copybot_prompt_container > .copybot_settings_main, #copybot_ghostwrite_textbox, #copybot_ghostwrite_exclude_container').slideDown(200);
			});
		}

    // UI 이벤트 설정 함수 (리스너 중복 방지 강화)
    function setupEventHandlers() {
    debugLog('깡갤 복사기: 이벤트 핸들러 설정 시작');

    // ---------------------------------------------
    // --- 프리셋 관리 이벤트 핸들러 (신규/수정) ---
    // ---------------------------------------------

    // 기존 방식 저장 (💾 아이콘)
    $(document).off('click', '#copybot_preset_save').on('click', '#copybot_preset_save', saveCurrentPreset);

    // 편집 모드 시작 (⚙️ 아이콘)
    $(document).off('click', '#copybot_preset_edit').on('click', '#copybot_preset_edit', function() {
        // 비활성화된 상태면 클릭 무시
        if ($(this).hasClass('disabled')) {
            return false;
        }
        enterPresetEditMode();
    });

    // 편집 취소 (❌ 아이콘)
    $(document).off('click', '#copybot_preset_cancel').on('click', '#copybot_preset_cancel', () => exitPresetEditMode(true));

    // 프리셋 선택 또는 관리 기능 실행 (드롭다운)
    $(document).off('change', '#copybot_preset_select').on('change', '#copybot_preset_select', function() {
        const selectedValue = $(this).val();
        // 관리 메뉴 선택 전의 원래 선택된 값을 data 속성에서 가져오기
        const originalValue = $(this).data('previousValue') || '';

        if (selectedValue === '__add__') {
            addNewPreset();
        } else if (selectedValue === '__reorder__') {
			$(this).val(originalValue); // 드롭다운 값 원상복구
			openReorderModal();
		} else if (selectedValue === '__copy__') {
			// 드롭다운 값을 원래대로 돌려놓고 복사 함수 실행
			$(this).val(originalValue);
			copyCurrentPreset();
		} else {
            // 일반 프리셋 선택 - 현재 값을 data 속성에 저장
            $(this).data('previousValue', selectedValue);
            loadPreset(selectedValue);
			updatePresetDropdown();
			updatePresetEditButtonState(); // 버튼 상태 업데이트 추가
            if (isPresetEditMode) {
                $('#copybot_preset_rename_input').val(selectedValue);
                if (selectedValue) {
                    $('#copybot_preset_delete').show();
                } else {
                    $('#copybot_preset_delete').hide();
                }
            }
        }
    });

    // 이름 변경 저장 (✔️ 아이콘)
    $(document).off('click', '#copybot_preset_confirm').on('click', '#copybot_preset_confirm', function() {
        const oldName = $('#copybot_preset_select').val();
        const newName = $('#copybot_preset_rename_input').val().trim();
        
        if (!oldName) {
            toastr.warning('이름을 변경할 프리셋이 선택되지 않았습니다.');
            return;
        }
        if (!newName) {
            toastr.error('프리셋 이름은 비워둘 수 없습니다.');
            return;
        }
        
        if (renamePreset(oldName, newName)) {
            toastr.success(`'${escapeHtml(oldName)}' -> '${escapeHtml(newName)}'(으)로 이름이 변경되었습니다.`);
            exitPresetEditMode(true);
            $('#copybot_preset_select').val(newName); // 변경된 이름으로 선택 유지
        }
    });

    // 프리셋 삭제 (🗑️ 아이콘)
    $(document).off('click', '#copybot_preset_delete').on('click', '#copybot_preset_delete', function() {
        const nameToDelete = $('#copybot_preset_select').val();
        if (!nameToDelete) {
            toastr.warning('삭제할 프리셋이 선택되지 않았습니다.');
            return;
        }
        
        if (confirm(`'${escapeHtml(nameToDelete)}' 프리셋을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            deletePreset(nameToDelete);
            toastr.success(`'${escapeHtml(nameToDelete)}' 프리셋이 삭제되었습니다.`);
            exitPresetEditMode(true);
        }
    });

    // 순서 변경 모달의 저장/취소 버튼
    $(document).off('click', '#copybot_reorder_save').on('click', '#copybot_reorder_save', function() {
        const newOrder = [];
        $('#copybot_reorder_list').find('li').each(function() {
            newOrder.push($(this).data('presetName'));
        });
        
        reorderPresets(newOrder);
        toastr.success('프리셋 순서가 저장되었습니다.');
        updatePresetDropdown();
        closeReorderModal();
    });
    $(document).off('click', '#copybot_reorder_cancel').on('click', '#copybot_reorder_cancel', closeReorderModal);

    // --- 순서 변경: 위/아래 버튼 방식으로 변경 ---
    $(document).off('click', '.copybot_move_up').on('click', '.copybot_move_up', function(e) {
        e.preventDefault();
        const item = $(this).closest('li');
        const prevItem = item.prev();
        if (prevItem.length > 0) {
            item.insertBefore(prevItem);
        }
    });
    
    $(document).off('click', '.copybot_move_down').on('click', '.copybot_move_down', function(e) {
        e.preventDefault();
        const item = $(this).closest('li');
        const nextItem = item.next();
        if (nextItem.length > 0) {
            item.insertAfter(nextItem);
        }
    });

	// 프리셋 이름 변경 입력창에서 Enter 키로 저장
	$(document).off('keydown', '#copybot_preset_rename_input').on('keydown', '#copybot_preset_rename_input', function(e) {
		// Enter 키가 눌렸는지 확인 (keyCode 13은 Enter)
		if (e.key === 'Enter' || e.which === 13) {
			// Enter 키의 기본 동작(예: 폼 제출)을 막습니다.
			e.preventDefault();
			
			// 이미 만들어진 저장(확인) 버튼을 프로그래밍 방식으로 클릭하여
			// 기존의 저장 로직을 그대로 재사용합니다.
			$('#copybot_preset_confirm').click();
		}
	});

    // 대필이 진행중일 때 중단 버튼을 누르면 작동하는 코드
    $(document).off('click', '#send_but.generation_progress').on('click', '#send_but.generation_progress', function() {
        if (isGhostwritingActive) {
            debugLog('대필 중단 버튼 클릭 감지! 중단 신호 보냅니다.');
            
            isGhostwritingActive = false; 

            try {
                if (typeof window.stopGeneration === 'function') {
                    window.stopGeneration();
                    debugLog('SillyTavern의 stopGeneration() 함수를 직접 호출했습니다.');
                }
            } catch (e) {
                console.error('stopGeneration 호출 실패', e);
            }
            
            if (ghostwriteOriginalProfile) {
                debugLog(`즉시 프로필 원복 시도: ${ghostwriteOriginalProfile}`);
                switchProfile(ghostwriteOriginalProfile, true);
                toastr.info('대필을 중단하고 원래 프로필로 복원합니다.');
            }
        }
    });

    
    const eventMap = {
        '#copybot_execute': () => {
            let startPos = parseInt($("#copybot_start").val());
            let endPos = parseInt($("#copybot_end").val());
            
            const startEmpty = isNaN(startPos) || $("#copybot_start").val().trim() === '';
            const endEmpty = isNaN(endPos) || $("#copybot_end").val().trim() === '';
            
            if (startEmpty || endEmpty) {
                if (startEmpty) $("#copybot_start").val(0);
                if (endEmpty) $("#copybot_end").val(getLastMessageIndex());
                toastr.info(`범위가 자동으로 설정되었습니다. 다시 복사 버튼을 눌러주세요.`);
                return;
            }
            
            const actualLastIndex = getLastMessageIndex();
            if (endPos > actualLastIndex) {
                endPos = actualLastIndex;
                $("#copybot_end").val(endPos);
                toastr.warning(`종료위치가 마지막 메시지(${actualLastIndex}번)로 자동 조정되었습니다.`);
            }
            
            if (startPos > endPos) { toastr.error('시작위치는 종료위치보다 작아야 합니다.'); return; }
            if (startPos < 0) { toastr.error('시작위치는 0 이상이어야 합니다.'); return; }
            executeCopyCommand(startPos, endPos);
        },
        '#copybot_multi_delete_execute': () => {
            const startPos = parseInt($("#copybot_multi_delete_start").val());
            const endPos = parseInt($("#copybot_multi_delete_end").val());

            if (isNaN(startPos) || isNaN(endPos)) {
                toastr.error('올바른 시작위치와 종료위치를 숫자로 입력해주세요.');
                return;
            }
            if (startPos < 0 || startPos > endPos) {
                toastr.error('올바른 범위를 입력해주세요.');
                return;
            }

            const messageCount = endPos - startPos + 1;
            if (confirm(`메시지 #${startPos}부터 #${endPos}까지, 총 ${messageCount}개를 영구적으로 삭제합니다.\n\n이 작업은 되돌릴 수 없습니다! 정말로 삭제하시겠습니까?`)) {
                executeSimpleCommand(`/cut ${startPos}-${endPos}`, `메시지 ${startPos}~${endPos} 삭제 명령을 실행했습니다.`);
            } else {
                toastr.info('메시지 삭제가 취소되었습니다.');
            }
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
        '#copybot_clear_content': () => {
            $('#copybot_textbox').val('').trigger('input');
            toastr.success('텍스트박스가 비워졌습니다.');
        },
        '#copybot_jump_first': () => {
            if (confirm("첫 메시지로 이동합니다.\n\n채팅이 많을 경우 렉이 발생할 수 있습니다.\n정말 이동하시겠습니까?")) {
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
        '#copybot_open_ghostwrite_button': (e) => { e.stopPropagation(); $('#copybot_settings_panel, #copybot_misc_panel').slideUp(200); $('#copybot_ghostwrite_panel').slideToggle(200, saveSettings); },
        '#copybot_open_settings_button': (e) => { e.stopPropagation(); $('#copybot_ghostwrite_panel, #copybot_misc_panel').slideUp(200); $('#copybot_settings_panel').slideToggle(200, saveSettings); },
        '#copybot_open_misc_button': (e) => { e.stopPropagation(); $('#copybot_ghostwrite_panel, #copybot_settings_panel').slideUp(200); $('#copybot_misc_panel').slideToggle(200, saveSettings); },
        '.copybot_toggle_button': function(e) {
            e.stopPropagation();
            const button = $(this);
            const isEnabled = button.attr('data-enabled') === 'true';
            const newState = !isEnabled;
            button.attr('data-enabled', newState).text(newState ? 'ON' : 'OFF');
            
            const actions = {
                'copybot_ghostwrite_toggle': () => $('#copybot_ghostwrite_position_options, #copybot_ghostwrite_textbox, #copybot_ghostwrite_exclude_container, #copybot_ghostwrite_panel .copybot_description').slideToggle(newState),
                'copybot_temp_field_toggle': addTempPromptField,
                'copybot_hq_profile_toggle': () => newState ? enableHighQualityProfiles() : disableHighQualityProfiles(),
                'copybot_remove_resize_toggle': () => newState ? removeResizeHandle() : restoreResizeHandle(),
                'copybot_debug_mode_toggle': () => { isDebugMode = newState; $('#copybot_debug_info').slideToggle(newState); },
            };
            const defaultAction = () => $(`#${button.attr('id').replace('_toggle', '_options')}`).slideToggle(newState);
            (actions[button.attr('id')] || defaultAction)();
            
            updateActionButtons();
            safeUpdateInputFieldIcons();
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
    // ... 이하 나머지 이벤트 핸들러들
    $(document).off('click', '#copybot_reload_profiles_button').on('click', '#copybot_reload_profiles_button', function() {
        debugLog('프로필 목록 수동 새로고침 실행');
        const currentlySelected = $('#copybot_ghostwrite_profile_select').val();
        loadGhostwriteProfiles();
        $('#copybot_ghostwrite_profile_select').val(currentlySelected);
        toastr.success('프로필 목록을 새로고침했습니다.');
        const icon = $(this);
        icon.addClass('fa-spin');
        setTimeout(() => icon.removeClass('fa-spin'), 500);
    });
    $(document).off('keypress', '#copybot_start, #copybot_end').on('keypress', '#copybot_start, #copybot_end', (e) => { if(e.which === 13) $('#copybot_execute').click(); });
    $(document).off('keypress', '#copybot_jump_number').on('keypress', '#copybot_jump_number', (e) => { if(e.which === 13) $('#copybot_jump_to').click(); });
    
    $(document).off('input', '#copybot_textbox').on('input', '#copybot_textbox', function() {
        const hasContent = $(this).val().trim().length > 0;
        $('#copybot_copy_content, #copybot_remove_tags, #copybot_linebreak_fix, #copybot_save_txt, #copybot_clear_content').prop('disabled', !hasContent);
    });

    $(document).off('change', '.copybot_checkbox, .copybot_radio').on('change', '.copybot_checkbox, .copybot_radio', () => {
        updateActionButtons();
        safeUpdateInputFieldIcons();
        saveSettings();
    });
    
    $(document).off('input', '#copybot_ghostwrite_textbox, #copybot_ghostwrite_exclude_textbox').on('input', '#copybot_ghostwrite_textbox, #copybot_ghostwrite_exclude_textbox', saveSettings);
    $(document).off('change', '#copybot_ghostwrite_profile_select').on('change', '#copybot_ghostwrite_profile_select', saveSettings);
    $(document).off('click', '#copybot_settings_panel, #copybot_ghostwrite_panel, #copybot_misc_panel').on('click', (e) => e.stopPropagation());

    debugLog('깡갤 복사기: 이벤트 핸들러 설정 완료');
}


    // **강화된 다중 시점 아이콘 업데이트 스케줄러**
    function scheduleIconUpdates() {
        debugLog('다중 시점 아이콘 업데이트 스케줄링 시작');
        
        // 첫 번째 시도: 즉시 시도 (DOM이 이미 준비되어 있을 수 있음)
        safeUpdateInputFieldIcons();
        
        // 추가 시도들: 점진적으로 늘어나는 간격으로 재시도
        const updateTimings = [200, 500, 1000, 2000, 3000]; // 마지막에 3초 추가
        
        updateTimings.forEach((timing, index) => {
            setTimeout(() => {
                debugLog(`${index + 2}번째 아이콘 업데이트 시도 (${timing}ms 후)`);
                safeUpdateInputFieldIcons();
            }, timing);
        });

        // 최종 백업 시도: 10초 후 강제 업데이트 (DOM 안정화 대기 없이)
        setTimeout(() => {
            debugLog('최종 백업 아이콘 업데이트 시도');
            if (isInputFieldReady()) {
                updateInputFieldIcons();
            } else {
                console.warn('깡갤 복사기: 최종 백업 시도에서도 DOM이 준비되지 않음');
            }
        }, 10000);
    }


    // 프로필 목록 로드 함수 (단순화)
    function loadGhostwriteProfiles() {
        try {
            const profileSelect = $('#copybot_ghostwrite_profile_select');
            const connectionProfilesDropdown = document.querySelector('#connection_profiles');
            
            if (!connectionProfilesDropdown) {
                debugLog('연결 프로필 드롭다운을 찾을 수 없음');
                return;
            }

            // 기존 옵션 제거 (기본값 제외)
            profileSelect.find('option:not(:first)').remove();
            
            // SillyTavern의 프로필 목록에서 옵션 추가
            Array.from(connectionProfilesDropdown.options).forEach(option => {
                if (option.value && option.value !== '') {
                    profileSelect.append(`<option value="${option.value}">${option.text}</option>`);
                }
            });
            
            debugLog('대필 프로필 목록 로드 완료:', profileSelect.find('option').length - 1, '개');
        } catch (error) {
            console.error('깡캐 복사기: 프로필 목록 로드 실패', error);
        }
    }

        async function switchProfile(targetProfileId, isRestore = false) {
        try {
            const connectionDropdown = document.querySelector('#connection_profiles');
            if (!connectionDropdown) {
                debugLog('연결 프로필 드롭다운을 찾을 수 없음');
                return false;
            }

            if (connectionDropdown.value === targetProfileId) {
                debugLog(`이미 ${targetProfileId} 프로필에 연결됨`);
                return true;
            }

            debugLog(`프로필 전환 시도: ${connectionDropdown.value} -> ${targetProfileId}`);
            
            connectionDropdown.value = targetProfileId;
            const changeEvent = new Event('change', { bubbles: true });
            connectionDropdown.dispatchEvent(changeEvent);

            // [최종 안정화] SillyTavern 서버가 프로필을 완전히 로드할 때까지 1.5초간 대기합니다.
            // 이 방식이 가장 단순하고 확실하게 타이밍 문제를 해결합니다.
            const waitTime = 1500;
            debugLog(`프로필 안정화를 위해 ${waitTime}ms 대기...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            const actionText = isRestore ? '복원' : '전환';
            debugLog(`프로필 ${actionText} 완료된 것으로 간주: ${targetProfileId}`);
            return true;

        } catch (error) {
            console.error('깡갤 복사기: 프로필 전환 실패', error);
            return false;
        }
    }

    // 초기화 함수
    async function initialize() {
        if (isInitialized) return;
        isInitialized = true;
        console.log('깡갤 복사기: 초기화 시작...');
        try {
            if ($("#extensions_settings2").length > 0) {
                $("#extensions_settings2").append(settingsHTML);
                debugLog('깡갤 복사기: UI 추가 성공');
                setupEventHandlers();
                
                setTimeout(() => {
                    loadSettings();
                    loadTempPrompt();
                    addTempPromptField();
                    updateActionButtons();
                    loadGhostwriteProfiles(); // 프로필 목록 로드 추가
                    updatePresetDropdown(); // 프리셋 드롭다운 메뉴 초기화
					updatePresetEditButtonState(); // 편집 버튼 상태 초기화
					
                    // 강화된 다중 시점 아이콘 업데이트 시도
                    scheduleIconUpdates();
                }, 100);
                
                console.log('깡갤 복사기: ✅ 초기화 완료!');
            } else {
                debugLog('깡갤 복사기: #extensions_settings2 요소를 찾을 수 없음. 3초 후 재시도...');
                setTimeout(() => { isInitialized = false; initialize(); }, 3000);
            }
        } catch(e) {
            console.error("깡갤 복사기: 초기화 실패", e);
        }
    }

    $(document).ready(function() {
        debugLog('깡갤 복사기: DOM 준비 완료');
        setTimeout(initialize, 1000);
        
        $(document).on('characterSelected chat_render_complete CHAT_CHANGED', () => {
            setTimeout(() => { 
                if (!isInitialized) initialize(); 
                addTempPromptField();
                loadTempPrompt();
                // 이벤트 기반 아이콘 업데이트도 안전한 방식으로 변경
                safeUpdateInputFieldIcons(); 
            }, 500);
        });
        
        // 효율적인 테마 변경 감지 (body class 변경만 감시)
        const themeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target === document.body && mutation.attributeName === 'class') {
                    debugLog('깡갤 복사기: 테마 변경 감지, 아이콘 및 임시 프롬프트 창 업데이트');
                    setTimeout(() => {
                        safeUpdateInputFieldIcons(); // 테마 변경 시에도 안전한 업데이트 사용
                        updateTempPromptStyle();
                    }, 100);
                }
            });
        });
        
        if (document.body) {
            themeObserver.observe(document.body, { 
                attributes: true, 
                attributeFilter: ['class'],
                subtree: false 
            });
        }
        
        $(document).on('change', '#character_select', () => {
            setTimeout(() => { if (!isInitialized) initialize(); }, 200);
        });
        $(document).on('click', '[data-i18n="Extensions"]', () => {
            setTimeout(() => { if (!isInitialized) initialize(); }, 500);
        });
        setTimeout(() => {
            if (!isInitialized) {
                debugLog('깡갤 복사기: 타이머 강제 초기화 실행');
                initialize();
            }
        }, 5000);
    });

    console.log('깡갤 복사기 확장프로그램이 로드되었습니다.');
})();