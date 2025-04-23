document.addEventListener('DOMContentLoaded', function() {
    const numbersContainer = document.getElementById('numbers');
    const numberAnalysisElement = document.getElementById('numberAnalysis');
    const todayDateElement = document.getElementById('todayDate');
    const nextUpdateElement = document.getElementById('nextUpdate');
    const generateBtn = document.getElementById('generateBtn');
    const birthdateInput = document.getElementById('birthdate');
    const birthtimeInput = document.getElementById('birthtime');
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
        // 기본 시드 값 (birthdate가 없는 경우 현재 날짜 사용)
        let seed = birthdate ? birthdate : new Date().toISOString().slice(0, 10).replace(/-/g, '');
        
        // 매주 일요일마다 다른 시드 생성을 위해 현재 주의 주간 키 추가
        const weekKey = getSundayWeekKey();
        seed += weekKey;
        
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
        const seed = generateSeed(birthdate, birthtime, dream);
        const numbers = Array.from({ length: 45 }, (_, i) => i + 1);
        let selectedNumbers = [];
        
        // 개인정보 기반 숫자 선호도 계산
        const personalPatterns = calculatePersonalPattern(birthdate, birthtime);
        
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
        
        // 시드 기반으로 난수 생성하여 번호 선택
        for (let i = 0; i < 6; i++) {
            const randomValue = seededRandom(seed, i);
            
            // 꿈 해시 기반 선택 (40% 확률, 꿈이 입력된 경우)
            if (randomValue < 0.4 && dreamHashes.length > 0 && 
                numbers.some(n => dreamHashes.includes(n))) {
                // 꿈 해시에서 유효한 숫자 선택
                const availableDreamNumbers = numbers.filter(n => dreamHashes.includes(n));
                const dreamIndex = Math.floor(seededRandom(seed + 'dream', i) * availableDreamNumbers.length);
                const selected = availableDreamNumbers[dreamIndex];
                
                selectedNumbers.push(selected);
                numbers.splice(numbers.indexOf(selected), 1);
            }
            // 개인 패턴 기반 선택 (30% 확률)
            else if (randomValue < 0.7 && personalPatterns.length > 0 && 
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
        
        // AC값 (추첨된 번호들의 평균 간격)
        const acValue = (45 / 6).toFixed(1); // 이론적 AC값
        const actualAC = ((numbers[numbers.length-1] - numbers[0]) / (numbers.length-1)).toFixed(1);
        
        // 번호의 연속성 검사
        const hasConsecutive = diffs.some(d => d === 1);
        
        // 최근 당첨 번호와의 일치 개수 (간단한 예시)
        const recentWinningNumbers = [3, 7, 12, 24, 31, 45]; // 실제 데이터로 대체 가능
        const matchCount = numbers.filter(n => recentWinningNumbers.includes(n)).length;
        
        // 꿈 내용 표시
        const dream = dreamInput.value.trim();
        let dreamAnalysisText = '';
        
        if (dream) {
            dreamAnalysisText = `
                <div style="margin-top: 10px; padding: 5px; background-color: #fff7e6; border-radius: 5px; border-left: 3px solid #ffb300;">
                    <p><strong>꿈 내용 반영:</strong> 입력한 꿈 내용이 번호 생성에 반영되었습니다.</p>
                </div>
            `;
        }
        
        // 표 스타일로 분석 결과 표시
        let analysisHTML = `
            <div style="margin-top: 20px; text-align: left; padding: 15px; background-color: #f9f9f9; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <h3 style="margin-bottom: 15px; color: #333; border-bottom: 2px solid #ddd; padding-bottom: 8px;">로또 번호 분석</h3>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                    <tr style="background-color: #f0f0f0;">
                        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd; width: 50%;">분석 항목</th>
                        <th style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd; width: 50%;">결과</th>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">합계 (Sum)</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;"></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">평균값</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${avg}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">홀/짝 비율</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${oddCount}:${evenCount} <span style="color: ${oddCount > 1 && evenCount > 1 ? 'green' : 'gray'}; font-size: 0.8em;">${oddCount > 1 && evenCount > 1 ? '✓ 균형' : ''}</span></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">번호간 평균 간격</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${avgDiff}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">끝자리 다양성</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${uniqueLastDigits}/6 <span style="color: ${uniqueLastDigits >= 4 ? 'green' : 'gray'}; font-size: 0.8em;">${uniqueLastDigits >= 4 ? '✓ 다양' : ''}</span></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">AC값 (실제/이론)</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${actualAC}/${acValue}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">연속된 번호</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${hasConsecutive ? '있음' : '없음'}</td>
                    </tr>
                </table>
                
                <div style="margin-top: 15px; margin-bottom: 15px;">
                    <h4 style="margin-bottom: 8px; font-size: 14px; color: #555;">구간별 분포</h4>
                    <div style="display: flex; height: 20px; border-radius: 3px; overflow: hidden; margin-top: 5px;">
                        <div style="width: ${ranges[0]/6*100}%; background-color: #FFB300; height: 100%;" title="1-10: ${ranges[0]}개"></div>
                        <div style="width: ${ranges[1]/6*100}%; background-color: #29B6F6; height: 100%;" title="11-20: ${ranges[1]}개"></div>
                        <div style="width: ${ranges[2]/6*100}%; background-color: #EF5350; height: 100%;" title="21-30: ${ranges[2]}개"></div>
                        <div style="width: ${ranges[3]/6*100}%; background-color: #66BB6A; height: 100%;" title="31-40: ${ranges[3]}개"></div>
                        <div style="width: ${ranges[4]/6*100}%; background-color: #AB47BC; height: 100%;" title="41-45: ${ranges[4]}개"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #777;">
                        <span>1-10 (${ranges[0]})</span>
                        <span>11-20 (${ranges[1]})</span>
                        <span>21-30 (${ranges[2]})</span>
                        <span>31-40 (${ranges[3]})</span>
                        <span>41-45 (${ranges[4]})</span>
                    </div>
                </div>
                ${dreamAnalysisText}
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

    // 번호 생성 버튼 이벤트 핸들러
    generateBtn.addEventListener('click', function() {
        const birthdate = birthdateInput.value.trim();
        const birthtime = birthtimeInput.value.trim();
        const dream = dreamInput.value.trim();
        
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