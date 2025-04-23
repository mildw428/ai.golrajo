document.addEventListener('DOMContentLoaded', function() {
    const numbersContainer = document.getElementById('numbers');
    const numberAnalysisElement = document.getElementById('numberAnalysis');
    const todayDateElement = document.getElementById('todayDate');
    const nextUpdateElement = document.getElementById('nextUpdate');
    const generateBtn = document.getElementById('generateBtn');
    const nameInput = document.getElementById('name');
    const birthdateInput = document.getElementById('birthdate');
    const birthtimeInput = document.getElementById('birthtime');
    const genderSelect = document.getElementById('gender');
    const dreamInput = document.getElementById('dream');

    let history = JSON.parse(localStorage.getItem('lottoHistory')) || [];

    function getSundayWeekKey() {
        const now = new Date();
        const sunday = new Date(now);
        const day = now.getDay();
        if (day !== 0) {
            sunday.setDate(now.getDate() + (7 - day));
        }
        const year = sunday.getFullYear();
        const month = (sunday.getMonth() + 1).toString().padStart(2, '0');
        const date = sunday.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${date}`;
    }

    function getNextUpdateTime() {
        const now = new Date();
        const next = new Date(now);
        const day = now.getDay();
        const daysUntilNextSunday = (7 - day) % 7 || 7;
        next.setDate(now.getDate() + daysUntilNextSunday);
        next.setHours(0, 0, 0, 0);
        return next;
    }

    function updateNextUpdateText() {
        const now = new Date();
        const nextUpdate = getNextUpdateTime();
        const diff = nextUpdate - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        nextUpdateElement.textContent = `다음 번호 갱신까지: ${hours}시간 ${minutes}분 ${seconds}초`;
        setTimeout(updateNextUpdateText, 1000);
        if (diff <= 1000) location.reload();
    }

    function showTodayDate() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        todayDateElement.textContent = now.toLocaleDateString('ko-KR', options);
    }

    function generateSeed(birthdate, birthtime, dream) {
        const name = nameInput.value.trim();
        const gender = genderSelect.value;
        
        // 기본 시드 값 (birthdate가 없는 경우 현재 날짜 사용)
        let seed = birthdate ? birthdate : new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        // 매주 일요일마다 다른 시드 생성을 위해 현재 주의 주간 키 추가
        const weekKey = getSundayWeekKey();
        seed += weekKey;
        
        // 이름을 시드에 반영 (이름의 각 문자를 해싱하여 추가)
        if (name) {
            let nameHash = 0;
            for (let i = 0; i < name.length; i++) {
                // 유니코드 값을 활용하여 한글 이름도 잘 처리되도록 함
                nameHash = ((nameHash << 5) - nameHash) + name.charCodeAt(i);
                nameHash = nameHash & nameHash; // 32비트 정수로 변환
            }
            // 이름 해시값이 큰 영향을 미치도록 충분히 큰 값을 곱함
            nameHash = Math.abs(nameHash) * 7919; // 큰 소수를 곱해 분포 향상
            seed += nameHash.toString();
        }
        
        // 성별을 시드에 반영 (성별에 따라 큰 차이가 나도록 다른 큰 소수를 곱함)
        if (gender) {
            const genderFactor = gender === '남자' ? 104729 : 104723; // 두 개의 서로 다른 큰 소수
            seed += genderFactor.toString();
        }
        
        // 생년월일, 시간, 꿈 내용을 모두 시드에 반영
        if (birthtime) seed += birthtime;
        if (dream) {
            // 꿈 내용에서 문자열을 숫자로 변환 (간단한 해시)
            let dreamHash = 0;
            for (let i = 0; i < dream.length; i++) {
                dreamHash = ((dreamHash << 5) - dreamHash) + dream.charCodeAt(i);
                dreamHash = dreamHash & dreamHash; // 32비트 정수로 변환
            }
            seed += Math.abs(dreamHash).toString();
        }
        
        return seed;
    }

    function analyzeKeywordsFromDream(dream) {
        if (!dream) return { luckyNumbers: [], themes: [] };
        
        // 꿈 키워드 분석
        const keywords = {
            행운의숫자: [1, 7, 8, 9, 13, 17, 23, 33, 37, 42, 45],
            풍요: [2, 6, 8, 9, 12, 18, 24, 28, 33, 42],
            성공: [1, 3, 5, 7, 11, 21, 27, 37, 41, 43],
            건강: [4, 10, 14, 19, 24, 29, 31, 36, 38, 40],
            사랑: [3, 6, 9, 12, 15, 21, 24, 30, 33, 36],
            가족: [5, 8, 13, 16, 22, 25, 30, 35, 38, 42]
        };
        
        const dreamText = dream.toLowerCase();
        let luckyNumbers = [];
        let themes = [];
        
        // 키워드 매칭 및 행운의 숫자 추출
        if (dreamText.includes('돈') || dreamText.includes('부자') || dreamText.includes('재물')) {
            luckyNumbers = [...luckyNumbers, ...keywords.풍요];
            themes.push('재물');
        }
        
        if (dreamText.includes('승진') || dreamText.includes('합격') || dreamText.includes('성공')) {
            luckyNumbers = [...luckyNumbers, ...keywords.성공];
            themes.push('성공');
        }
        
        if (dreamText.includes('건강') || dreamText.includes('치유') || dreamText.includes('병원')) {
            luckyNumbers = [...luckyNumbers, ...keywords.건강];
            themes.push('건강');
        }
        
        if (dreamText.includes('사랑') || dreamText.includes('연인') || dreamText.includes('결혼')) {
            luckyNumbers = [...luckyNumbers, ...keywords.사랑];
            themes.push('사랑');
        }
        
        if (dreamText.includes('가족') || dreamText.includes('부모') || dreamText.includes('자식')) {
            luckyNumbers = [...luckyNumbers, ...keywords.가족];
            themes.push('가족');
        }
        
        // 특별한 키워드가 없다면 기본 행운 숫자 추가
        if (luckyNumbers.length === 0) {
            luckyNumbers = [...keywords.행운의숫자];
        }
        
        // 중복 제거 및 1-45 범위 내 숫자만 선택
        luckyNumbers = [...new Set(luckyNumbers)].filter(n => n >= 1 && n <= 45);
        
        return {
            luckyNumbers,
            themes
        };
    }

    function seededRandom(seed, index) {
        // 개선된 시드 기반 난수 생성기
        // 다양한 수학 연산을 통해 더 복잡한 난수 생성
        let value = Math.sin(parseInt(seed) * (index + 1)) * 10000;
        value = Math.abs(Math.tan(value) * Math.cos(value + index)) * 9999;
        return value - Math.floor(value);
    }

    function generateNumbers(birthdate, birthtime, dream) {
        const name = nameInput.value.trim();
        const gender = genderSelect.value;
        const seed = generateSeed(birthdate, birthtime, dream);
        const numbers = Array.from({ length: 45 }, (_, i) => i + 1);
        let selectedNumbers = [];
        
        // 개인정보 기반 숫자 선호도 계산
        const personalPatterns = calculatePersonalPattern(birthdate, birthtime);
        
        // 성별 기반 가중치 적용
        const genderWeight = gender === '남자' ? 0.65 : 0.55; // 남자는 65%, 여자는 55%의 가중치
        
        // 꿈 내용이 있는 경우 해시 기반 선택을 위한 준비
        let dreamHashes = [];
        if (dream && dream.trim().length > 0) {
            // 꿈 텍스트를 여러 단어로 분리
            const words = dream.trim().split(/\s+/);
            
            // 각 단어에 대해 해시값 생성
            dreamHashes = words.map((word, idx) => {
                let hash = 0;
                for (let i = 0; i < word.length; i++) {
                    hash = ((hash << 5) - hash) + word.charCodeAt(i);
                    hash = hash & hash;
                }
                // 1부터 45 사이의 값으로 변환
                return Math.abs(hash) % 45 + 1;
            });
            
            // 중복 제거
            dreamHashes = [...new Set(dreamHashes)];
        }
        
        // 이름 기반 선호 숫자 생성
        let namePreferences = [];
        if (name) {
            for (let i = 0; i < name.length; i++) {
                const charCode = name.charCodeAt(i);
                const numValue = (charCode % 45) + 1;
                namePreferences.push(numValue);
                
                // 인접한 두 글자를 결합한 숫자도 추가
                if (i < name.length - 1) {
                    const nextCharCode = name.charCodeAt(i + 1);
                    const combinedValue = ((charCode + nextCharCode) % 45) + 1;
                    namePreferences.push(combinedValue);
                }
            }
            namePreferences = [...new Set(namePreferences)];
        }
        
        // 시드 기반으로 난수 생성하여 번호 선택
        for (let i = 0; i < 6; i++) {
            const randomValue = seededRandom(seed, i);
            
            // 이름 기반 선택 (30% 확률, 이름이 있는 경우)
            if (randomValue < 0.3 && namePreferences.length > 0 && 
                numbers.some(n => namePreferences.includes(n))) {
                const availableNameNumbers = numbers.filter(n => namePreferences.includes(n));
                const nameIndex = Math.floor(seededRandom(seed + 'name', i) * availableNameNumbers.length);
                const selected = availableNameNumbers[nameIndex];
                
                selectedNumbers.push(selected);
                numbers.splice(numbers.indexOf(selected), 1);
            }
            // 성별 기반 선택 (25% 확률, 성별이 선택된 경우)
            else if (randomValue < 0.55 && gender) {
                const isOdd = (n) => n % 2 === 1;
                const isPreferred = gender === '남자' ? isOdd : (n => !isOdd(n));
                
                const genderPreferred = numbers.filter(isPreferred);
                
                if (genderPreferred.length > 0) {
                    const genderIndex = Math.floor(seededRandom(seed + 'gender', i) * genderPreferred.length);
                    const selected = genderPreferred[genderIndex];
                    
                    selectedNumbers.push(selected);
                    numbers.splice(numbers.indexOf(selected), 1);
                } else {
                    // 선호 숫자가 없으면 일반 선택
                    const randomIndex = Math.floor(seededRandom(seed + i, i) * numbers.length);
                    selectedNumbers.push(numbers[randomIndex]);
                    numbers.splice(randomIndex, 1);
                }
            }
            // 꿈 해시 기반 선택 (20% 확률, 꿈이 입력된 경우)
            else if (randomValue < 0.75 && dreamHashes.length > 0 && 
                numbers.some(n => dreamHashes.includes(n))) {
                // 꿈 해시에서 유효한 숫자 선택
                const availableDreamNumbers = numbers.filter(n => dreamHashes.includes(n));
                const dreamIndex = Math.floor(seededRandom(seed + 'dream', i) * availableDreamNumbers.length);
                const selected = availableDreamNumbers[dreamIndex];
                
                selectedNumbers.push(selected);
                numbers.splice(numbers.indexOf(selected), 1);
            }
            // 개인 패턴 기반 선택 (15% 확률)
            else if (randomValue < 0.9 && personalPatterns.length > 0 && 
                    numbers.some(n => personalPatterns.includes(n))) {
                const availablePatterns = numbers.filter(n => personalPatterns.includes(n));
                const patternIndex = Math.floor(seededRandom(seed + 'pattern', i) * availablePatterns.length);
                const selected = availablePatterns[patternIndex % availablePatterns.length];
                
                selectedNumbers.push(selected);
                numbers.splice(numbers.indexOf(selected), 1);
            } 
            // 순수 랜덤 선택
            else {
                const adjustedRandom = seededRandom(seed + i, i * 3);
                const randomIndex = Math.floor(adjustedRandom * numbers.length);
                selectedNumbers.push(numbers[randomIndex]);
                numbers.splice(randomIndex, 1);
            }
        }
        
        return selectedNumbers.sort((a, b) => a - b);
    }
    
    function calculatePersonalPattern(birthdate, birthtime) {
        const patterns = [];
        const name = nameInput.value.trim();
        const gender = genderSelect.value;
        
        // 생년월일에서 패턴 추출
        if (birthdate) {
            // 생일 (일)
            const day = parseInt(birthdate.slice(6, 8));
            if (day > 0 && day <= 45) patterns.push(day);
            
            // 생월
            const month = parseInt(birthdate.slice(4, 6));
            if (month > 0 && month <= 45) patterns.push(month);
            
            // 태어난 해의 마지막 두 자리
            const year = parseInt(birthdate.slice(2, 4));
            if (year > 0 && year <= 45) patterns.push(year);
            
            // 생월+생일
            const monthPlusDay = month + day;
            if (monthPlusDay > 0 && monthPlusDay <= 45) patterns.push(monthPlusDay);
        }
        
        // 태어난 시간에서 패턴 추출
        if (birthtime) {
            // 시간
            const hour = parseInt(birthtime.slice(0, 2));
            if (hour > 0 && hour <= 45) patterns.push(hour);
            
            // 분
            const minute = parseInt(birthtime.slice(2, 4));
            if (minute > 0 && minute <= 45) patterns.push(minute);
            
            // 시+분
            const hourPlusMinute = hour + minute;
            if (hourPlusMinute > 0 && hourPlusMinute <= 45) patterns.push(hourPlusMinute);
        }
        
        // 이름에서 패턴 추출
        if (name) {
            // 이름의 각 글자에서 숫자 패턴 추출
            for (let i = 0; i < name.length; i++) {
                const charCode = name.charCodeAt(i);
                // 한글(0xAC00-0xD7A3) 또는 영문(65-122)인 경우에만 처리
                if ((charCode >= 0xAC00 && charCode <= 0xD7A3) || 
                    (charCode >= 65 && charCode <= 122)) {
                    // 유니코드 값을 1-45 사이의 값으로 변환
                    const patternValue = (charCode % 45) + 1;
                    patterns.push(patternValue);
                }
            }
        }
        
        // 성별에서 패턴 추출
        if (gender) {
            // 남자는 홀수 선호, 여자는 짝수 선호
            if (gender === '남자') {
                patterns.push(1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45);
            } else {
                patterns.push(2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44);
            }
        }
        
        return [...new Set(patterns)]; // 중복 제거
    }

    function displayNumbers(numbers) {
        numbersContainer.innerHTML = '';
        numbers.forEach(number => {
            const numberDiv = document.createElement('div');
            numberDiv.className = `number ${getColorClass(number)}`;
            numberDiv.textContent = number;
            numbersContainer.appendChild(numberDiv);
        });
        
        // 번호 분석 정보 표시
        displayNumberAnalysis(numbers);
    }
    
    function displayNumberAnalysis(numbers) {
        // 번호 합계, 평균, 홀짝 비율 등 분석
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = (sum / numbers.length).toFixed(1);
        const oddCount = numbers.filter(n => n % 2 === 1).length;
        const evenCount = numbers.filter(n => n % 2 === 0).length;
        
        // 차이값 계산 (연속된 두 숫자의 차이)
        const diffs = [];
        for (let i = 0; i < numbers.length - 1; i++) {
            diffs.push(numbers[i+1] - numbers[i]);
        }
        const avgDiff = (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1);
        
        // 끝자리 숫자 분석
        const lastDigits = numbers.map(n => n % 10);
        const uniqueLastDigits = [...new Set(lastDigits)].length;
        
        // 구간별 숫자 분포
        const ranges = [
            numbers.filter(n => n >= 1 && n <= 10).length,
            numbers.filter(n => n >= 11 && n <= 20).length,
            numbers.filter(n => n >= 21 && n <= 30).length,
            numbers.filter(n => n >= 31 && n <= 40).length,
            numbers.filter(n => n >= 41 && n <= 45).length
        ];
        
        // 표 스타일로 분석 결과 표시
        let analysisHTML = `
            
            <div class="lotto-analysis">
                <h3>로또 번호 분석</h3>
                
                <div class="analysis-table">
                    <div class="analysis-row">
                        <div class="analysis-label">번호 합계</div>
                        <div class="analysis-value">${sum}</div>
                    </div>
                    <div class="analysis-row">
                        <div class="analysis-label">평균값</div>
                        <div class="analysis-value">${avg}</div>
                    </div>
                    <div class="analysis-row">
                        <div class="analysis-label">홀/짝 비율</div>
                        <div class="analysis-value">${oddCount}:${evenCount} <span class="${oddCount > 1 && evenCount > 1 ? 'good' : 'neutral'}">${oddCount > 1 && evenCount > 1 ? '✓ 균형' : '균형 부족'}</span></div>
                    </div>
                    <div class="analysis-row">
                        <div class="analysis-label">번호간 평균 간격</div>
                        <div class="analysis-value">${avgDiff}</div>
                    </div>
                    <div class="analysis-row">
                        <div class="analysis-label">끝자리 다양성</div>
                        <div class="analysis-value">${uniqueLastDigits}/6 <span class="${uniqueLastDigits >= 4 ? 'good' : 'neutral'}">${uniqueLastDigits >= 4 ? '✓ 다양' : '다양성 부족'}</span></div>
                    </div>
                </div>
                
                <div class="number-distribution">
                    <h4>번호 구간별 분포</h4>
                    <div class="distribution-bar">
                        <div class="dist-1-10" style="width: ${ranges[0]/6*100}%" title="1-10: ${ranges[0]}개"></div>
                        <div class="dist-11-20" style="width: ${ranges[1]/6*100}%" title="11-20: ${ranges[1]}개"></div>
                        <div class="dist-21-30" style="width: ${ranges[2]/6*100}%" title="21-30: ${ranges[2]}개"></div>
                        <div class="dist-31-40" style="width: ${ranges[3]/6*100}%" title="31-40: ${ranges[3]}개"></div>
                        <div class="dist-41-45" style="width: ${ranges[4]/6*100}%" title="41-45: ${ranges[4]}개"></div>
                    </div>
                    <div class="distribution-labels">
                        <span>1-10 (${ranges[0]})</span>
                        <span>11-20 (${ranges[1]})</span>
                        <span>21-30 (${ranges[2]})</span>
                        <span>31-40 (${ranges[3]})</span>
                        <span>41-45 (${ranges[4]})</span>
                    </div>
                </div>
            </div>
        `;
        
        numberAnalysisElement.innerHTML = analysisHTML;
    }

    function addToHistory(numbers, birthdate, birthtime, dream) {
        const now = new Date();
        const dateKey = getSundayWeekKey();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // 입력 값 저장
        const inputs = {
            birthdate: birthdate || '',
            birthtime: birthtime || '',
            dream: dream || ''
        };
        
        // 같은 주에 같은 입력값으로 이미 생성된 번호가 있는지 확인
        const existingIndex = history.findIndex(item => 
            item.date === dateKey && 
            item.inputs?.birthdate === inputs.birthdate && 
            item.inputs?.birthtime === inputs.birthtime && 
            item.inputs?.dream === inputs.dream
        );
        
        if (existingIndex !== -1) {
            return history[existingIndex].numbers;
        } else {
            const historyItem = { 
                date: dateKey, 
                time: timeString, 
                numbers: numbers,
                inputs: inputs
            };
            
            history.unshift(historyItem);
            if (history.length > 30) history.pop();
            localStorage.setItem('lottoHistory', JSON.stringify(history));
            return numbers;
        }
    }
    
    function renderHistory() {
        const historyTitle = '<h3>이전 번호 기록</h3>';
        if (history.length === 0) {
            historyContainer.innerHTML = historyTitle + '<p>아직 기록이 없습니다.</p>';
            return;
        }

        const currentWeekKey = getSundayWeekKey();
        const filteredHistory = history.filter(item => item.date !== currentWeekKey);

        if (filteredHistory.length === 0) {
            historyContainer.innerHTML = historyTitle + '<p>아직 이전 기록이 없습니다.</p>';
            return;
        }

        const sortedHistory = [...filteredHistory].sort((a, b) => b.date.localeCompare(a.date));

        let historyHTML = historyTitle;
        sortedHistory.forEach(item => {
            historyHTML += `
                <div class="history-item">
                    <div>${item.date}</div>
                    <div class="history-numbers">
                        ${item.numbers.map(num => `<div class="history-number ${getColorClass(num)}">${num}</div>`).join('')}
                    </div>
                </div>
            `;
        });

        historyContainer.innerHTML = historyHTML;
    }

    function getColorClass(number) {
        if (number <= 10) return 'num-1-10';
        if (number <= 20) return 'num-11-20';
        if (number <= 30) return 'num-21-30';
        if (number <= 40) return 'num-31-40';
        return 'num-41-45';
    }

    function initializeWeeklyNumbers() {
        showTodayDate();
        // 초기 로딩 시에는 번호를 표시하지 않음
        numbersContainer.innerHTML = '<p style="padding: 20px;">위의 생년월일을 입력하고 번호를 생성해보세요!</p>';
        numberAnalysisElement.innerHTML = '';
    }

    // 결과 메시지 생성 함수 
    function generateResultMessage(name, gender, birthdate) {
        if (!name || !birthdate) return "생년월일과 이름을 입력하시면 더 정확한 분석이 가능합니다.";
        
        const day = parseInt(birthdate.slice(6, 8));
        const month = parseInt(birthdate.slice(4, 6));
        const year = parseInt(birthdate.slice(0, 4));
        
        const messages = [
            `${name}님의 사주를 분석한 결과, 이번 주는 행운이 따르는 주간입니다.`,
            `${month}월 생인 ${name}님은 물과 관련된 숫자에 행운이 있습니다.`,
            `태어난 해(${year}년)의 영향으로 발전과 성장의 기운이 느껴집니다.`,
            `${gender === '남자' ? '양' : '음'}의 기운이 강하게 나타나 직관력이 뛰어난 시기입니다.`,
            `천간과 지지의 조합이 ${name}님에게 긍정적인 에너지를 줍니다.`,
            `오행의 균형이 잘 맞아 안정감 있는 운세를 보여줍니다.`
        ];
        
        // 생일 날짜에 따라 메시지 선택
        const messageIndex = day % messages.length;
        return messages[messageIndex];
    }
    
    // 꿈 해몽 분석 함수
    function analyzeDream(dream) {
        if (!dream) return "";
        
        const keywords = {
            '돈': '재물운이 상승하고 있습니다. 투자에 좋은 시기입니다.',
            '물': '감정의 흐름이 원활해지고 새로운 기회가 찾아올 수 있습니다.',
            '산': '성취와 목표 달성을 암시합니다. 도전적인 일을 시작하기 좋은 시기입니다.',
            '불': '열정과 에너지가 넘치는 시기입니다. 새로운 시작에 좋습니다.',
            '집': '안정과 보호를 상징합니다. 가정에 행복한 일이, 생길 수 있습니다.',
            '차': '인생의 방향성과 관련이 있습니다. 새로운 도전을 앞두고 있을 수 있습니다.',
            '사람': '대인관계에 변화가 있을 수 있습니다. 새로운 만남에 주목하세요.'
        };
        
        for (const [key, value] of Object.entries(keywords)) {
            if (dream.includes(key)) {
                return value;
            }
        }
        
        return "꿈에서 특별한 의미를 찾을 수 없습니다. 하지만 직관을 믿는 것이 도움이 될 수 있습니다.";
    }

    // 번호 생성 버튼 이벤트 핸들러
    generateBtn.addEventListener('click', function() {
        const birthdate = birthdateInput.value.trim();
        const birthtime = birthtimeInput.value.trim();
        const dream = dreamInput.value.trim();
        const name = nameInput.value.trim();
        const gender = genderSelect.value;
        
        if (!birthdate) {
            alert('생년월일을 입력해주세요!');
            return;
        }
        
        // 생년월일 형식 검사 (YYYYMMDD)
        if (!/^\d{8}$/.test(birthdate)) {
            alert('생년월일은 YYYYMMDD 형식으로 입력해주세요!');
            return;
        }
        
        // 태어난 시간 형식 검사 (선택사항, HHMM)
        if (birthtime && !/^\d{4}$/.test(birthtime)) {
            alert('태어난 시간은 HHMM 형식으로 입력해주세요!');
            return;
        }
        
        const numbers = generateNumbers(birthdate, birthtime, dream);
        addToHistory(numbers, birthdate, birthtime, dream);
        displayNumbers(numbers);
    });

    showTodayDate();
    updateNextUpdateText();
    initializeWeeklyNumbers();
}); 