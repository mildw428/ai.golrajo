// 전역 변수 설정
const API_ENDPOINT = 'https://dh1o9nmzy8.execute-api.ap-northeast-2.amazonaws.com/prod/merge'
const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32MB
const MAX_FILES = 100;

// 이미지 파일 저장 배열
let uploadedImages = [];

// 토스트 메시지 설정
toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: "toast-top-right",
    timeOut: 3000
};

// DOM이 완전히 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    // 엘리먼트 참조
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const addFilesBtn = document.getElementById('add-files-btn');
    const previewSection = document.getElementById('preview-section');
    const mergeSection = document.getElementById('merge-section');
    const resultSection = document.getElementById('result-section');
    const imagesContainer = document.getElementById('images-container');
    const selectAllBtn = document.getElementById('select-all-btn');
    const removeSelectedBtn = document.getElementById('remove-selected-btn');
    const moveUpBtn = document.getElementById('move-up-btn');
    const moveDownBtn = document.getElementById('move-down-btn');
    const mergeDirectionSelect = document.getElementById('merge-direction');
    const targetWidthGroup = document.getElementById('target-width-group');
    const targetHeightGroup = document.getElementById('target-height-group');
    const noBorderBtn = document.getElementById('no-border-btn');
    const startMergeBtn = document.getElementById('start-merge-btn');
    const downloadBtn = document.getElementById('download-btn');
    const newMergeBtn = document.getElementById('new-merge-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const resultImage = document.getElementById('result-image');

    // 이벤트 리스너 설정
    // 파일 업로드 이벤트
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    addFilesBtn.addEventListener('click', () => fileInput.click());

    // 드래그 앤 드롭 이벤트
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // 이미지 관리 이벤트
    selectAllBtn.addEventListener('click', toggleSelectAllImages);
    removeSelectedBtn.addEventListener('click', removeSelectedImages);
    moveUpBtn.addEventListener('click', moveSelectedImagesUp);
    moveDownBtn.addEventListener('click', moveSelectedImagesDown);

    // 병합 설정 이벤트
    mergeDirectionSelect.addEventListener('change', updateResizeOptions);
    noBorderBtn.addEventListener('click', disableBorder);
    startMergeBtn.addEventListener('click', mergeImages);

    // 결과 이벤트
    downloadBtn.addEventListener('click', downloadMergedImage);
    newMergeBtn.addEventListener('click', resetApplication);

    // 초기 상태 설정
    updateResizeOptions();
});

// 파일 선택 처리
function handleFileSelect(event) {
    const files = event.target.files;
    processFiles(files);
}

// 드래그 오버 이벤트
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('dragging');
}

// 드래그 리브 이벤트
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dragging');
}

// 드롭 이벤트
function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('dragging');
    
    const items = event.dataTransfer.items;
    const files = event.dataTransfer.files;
    
    if (items && items.length > 0) {
        // DataTransferItemList 객체를 사용하여 디렉토리 처리
        processDataTransferItems(items);
    } else if (files && files.length > 0) {
        // FileList 객체만 사용할 수 있는 경우
        processFiles(files);
    }
}

// 데이터 전송 항목 처리 (디렉토리 포함)
async function processDataTransferItems(items) {
    const files = [];
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            
            if (entry) {
                if (entry.isFile) {
                    const file = await getFileFromEntry(entry);
                    if (file) files.push(file);
                } else if (entry.isDirectory) {
                    const dirFiles = await getFilesFromDirectory(entry);
                    files.push(...dirFiles);
                }
            } else {
                // 폴백: 항목에서 직접 파일 가져오기
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
    }
    
    processFiles(files);
}

// 항목에서 파일 가져오기
function getFileFromEntry(entry) {
    return new Promise(resolve => {
        entry.file(file => resolve(file), () => resolve(null));
    });
}

// 디렉토리에서 모든 파일 재귀적으로 가져오기
async function getFilesFromDirectory(dirEntry) {
    const files = [];
    const reader = dirEntry.createReader();
    
    const readEntries = () => new Promise(resolve => {
        reader.readEntries(entries => resolve(entries), () => resolve([]));
    });
    
    let entries = await readEntries();
    while (entries.length > 0) {
        for (const entry of entries) {
            if (entry.isFile) {
                const file = await getFileFromEntry(entry);
                if (file) files.push(file);
            } else if (entry.isDirectory) {
                const subFiles = await getFilesFromDirectory(entry);
                files.push(...subFiles);
            }
        }
        entries = await readEntries();
    }
    
    return files;
}

// 파일 처리 및 검증
function processFiles(files) {
    const imageFiles = Array.from(files).filter(file => {
        // 이미지 파일만 필터링
        if (!file.type.startsWith('image/')) {
            toastr.warning(`${file.name}은(는) 이미지 파일이 아닙니다.`);
            return false;
        }
        
        // 파일 크기 검증
        if (file.size > MAX_FILE_SIZE) {
            toastr.warning(`${file.name}은(는) 최대 크기(32MB)를 초과합니다.`);
            return false;
        }
        
        return true;
    });
    
    // 최대 파일 수 검증
    if (uploadedImages.length + imageFiles.length > MAX_FILES) {
        toastr.warning(`최대 ${MAX_FILES}개의 이미지만 업로드할 수 있습니다.`);
        imageFiles.splice(MAX_FILES - uploadedImages.length);
    }
    
    // 이미지 파일 처리
    if (imageFiles.length > 0) {
        const filesProcessed = imageFiles.length;
        
        // 각 이미지 파일 처리
        imageFiles.forEach(file => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const imageData = {
                    file: file,
                    name: file.name,
                    src: e.target.result,
                    base64: e.target.result.split(',')[1],
                    rotation: 0,
                    selected: false
                };
                
                uploadedImages.push(imageData);
                addImageToUI(imageData, uploadedImages.length - 1);
            };
            
            reader.readAsDataURL(file);
        });
        
        // UI 섹션 표시
        document.getElementById('preview-section').classList.remove('hidden');
        
        toastr.success(`${filesProcessed}개의 이미지를 성공적으로 추가했습니다.`);
    }
}

// UI에 이미지 추가
function addImageToUI(imageData, index) {
    const template = document.getElementById('image-item-template');
    const imageItem = document.importNode(template.content, true).querySelector('.image-item');
    
    // 이미지 정보 설정
    const img = imageItem.querySelector('img');
    img.src = imageData.src;
    
    // 컨트롤 설정
    const rotationSelect = imageItem.querySelector('.rotation');
    const removeBtn = imageItem.querySelector('.remove-btn');
    
    // 이미지 카드 클릭 이벤트 (선택 토글용)
    imageItem.querySelector('.image-preview').addEventListener('click', function() {
        imageData.selected = !imageData.selected;
        if (imageData.selected) {
            imageItem.classList.add('image-selected');
        } else {
            imageItem.classList.remove('image-selected');
        }
        updateSelectedImagesControls();
    });
    
    rotationSelect.addEventListener('change', function() {
        imageData.rotation = parseInt(this.value);
        img.style.transform = `rotate(${imageData.rotation}deg)`;
    });
    
    removeBtn.addEventListener('click', function() {
        // 배열에서 이미지 제거
        uploadedImages.splice(index, 1);
        // UI에서 이미지 제거
        imageItem.remove();
        // 이미지 재인덱싱
        updateImageIndices();
        // 이미지가 없으면 섹션 숨기기
        if (uploadedImages.length === 0) {
            document.getElementById('preview-section').classList.add('hidden');
        }
        
        toastr.info('이미지가 제거되었습니다.');
    });
    
    // 이미지 컨테이너에 추가
    document.getElementById('images-container').appendChild(imageItem);
}

// 이미지 인덱스 업데이트
function updateImageIndices() {
    const imageItems = document.querySelectorAll('.image-item');
    // 인덱스 업데이트는 필요 없음 (이미지 번호 기능 제거됨)
}

// 선택된 이미지 컨트롤 업데이트
function updateSelectedImagesControls() {
    const hasSelectedImages = uploadedImages.some(img => img.selected);
    document.getElementById('remove-selected-btn').disabled = !hasSelectedImages;
    document.getElementById('move-up-btn').disabled = !hasSelectedImages;
    document.getElementById('move-down-btn').disabled = !hasSelectedImages;
}

// 모든 이미지 선택/해제 토글
function toggleSelectAllImages() {
    const allSelected = uploadedImages.every(img => img.selected);
    
    // 모든 이미지가 이미 선택되어 있으면 모두 해제, 아니면 모두 선택
    const newState = !allSelected;
    
    uploadedImages.forEach((img, index) => {
        img.selected = newState;
    });
    
    // UI 업데이트
    const imageItems = document.querySelectorAll('.image-item');
    
    imageItems.forEach((item, index) => {
        if (newState) {
            item.classList.add('image-selected');
        } else {
            item.classList.remove('image-selected');
        }
    });
    
    updateSelectedImagesControls();
}

// 선택된 이미지 제거
function removeSelectedImages() {
    const selectedIndices = uploadedImages
        .map((img, index) => img.selected ? index : -1)
        .filter(index => index !== -1)
        .sort((a, b) => b - a); // 역순으로 정렬하여 인덱스 문제 방지
    
    if (selectedIndices.length === 0) return;
    
    // 선택된 이미지 제거
    selectedIndices.forEach(index => {
        uploadedImages.splice(index, 1);
    });
    
    // UI 재구성
    refreshImagesUI();
    
    // 이미지가 없으면 섹션 숨기기
    if (uploadedImages.length === 0) {
        document.getElementById('preview-section').classList.add('hidden');
    }
    
    toastr.info(`${selectedIndices.length}개의 이미지가 제거되었습니다.`);
}

// 이미지 UI 새로고침
function refreshImagesUI() {
    const imagesContainer = document.getElementById('images-container');
    imagesContainer.innerHTML = ''; // 모든 이미지 항목 제거
    
    // 이미지 다시 추가
    uploadedImages.forEach((img, index) => {
        addImageToUI(img, index);
    });
}

// 선택된 이미지 위로 이동
function moveSelectedImagesUp() {
    const selectedIndices = uploadedImages
        .map((img, index) => img.selected ? index : -1)
        .filter(index => index !== -1 && index > 0); // 첫 번째 이미지는 위로 이동 불가
    
    if (selectedIndices.length === 0) return;
    
    // 선택된 이미지를 위로 이동
    selectedIndices.sort((a, b) => a - b).forEach(index => {
        // 이미지 교체
        const temp = uploadedImages[index];
        uploadedImages[index] = uploadedImages[index - 1];
        uploadedImages[index - 1] = temp;
    });
    
    // UI 재구성
    refreshImagesUI();
    
    toastr.info('선택된 이미지가 위로 이동되었습니다.');
}

// 선택된 이미지 아래로 이동
function moveSelectedImagesDown() {
    const selectedIndices = uploadedImages
        .map((img, index) => img.selected ? index : -1)
        .filter(index => index !== -1 && index < uploadedImages.length - 1); // 마지막 이미지는 아래로 이동 불가
    
    if (selectedIndices.length === 0) return;
    
    // 선택된 이미지를 아래로 이동 (역순으로 처리하여 인덱스 문제 방지)
    selectedIndices.sort((a, b) => b - a).forEach(index => {
        // 이미지 교체
        const temp = uploadedImages[index];
        uploadedImages[index] = uploadedImages[index + 1];
        uploadedImages[index + 1] = temp;
    });
    
    // UI 재구성
    refreshImagesUI();
    
    toastr.info('선택된 이미지가 아래로 이동되었습니다.');
}

// 리사이즈 옵션 업데이트
function updateResizeOptions() {
    const direction = document.getElementById('merge-direction').value;
    const targetWidthGroup = document.getElementById('target-width-group');
    const targetHeightGroup = document.getElementById('target-height-group');
    
    if (direction === 'horizontal' || direction === 'horizontal_2x') {
        targetWidthGroup.classList.add('hidden');
        targetHeightGroup.classList.remove('hidden');
    } else { // vertical
        targetWidthGroup.classList.remove('hidden');
        targetHeightGroup.classList.add('hidden');
    }
}

// 테두리 비활성화
function disableBorder() {
    document.getElementById('border-color').value = '#ffffff';
    document.getElementById('border-width').value = '0';
}

// 이미지 병합 함수
async function mergeImages() {
    if (uploadedImages.length === 0) {
        toastr.error('병합할 이미지가 없습니다.');
        return;
    }
    
    // 로딩 오버레이 표시
    document.getElementById('loading-overlay').classList.remove('hidden');
    
    try {
        // 옵션 값 가져오기
        const options = {
            direction: document.getElementById('merge-direction').value,
            spacing: parseInt(document.getElementById('image-spacing').value) || 0,
            alignment: document.getElementById('alignment').value,
            targetWidth: parseInt(document.getElementById('target-width').value) || 550,
            targetHeight: parseInt(document.getElementById('target-height').value) || 800,
            borderColor: document.getElementById('border-color').value,
            borderWidth: parseInt(document.getElementById('border-width').value) || 0,
            outputFormat: document.getElementById('output-format').value
        };
        
        // API 서버에 병합 요청
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                images: uploadedImages,
                options: options
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '서버 오류가 발생했습니다.');
        }
        
        const result = await response.json();
        
        // 결과 이미지 표시
        document.getElementById('result-image').src = result.url;
        document.getElementById('result-section').classList.remove('hidden');
        
        // 다운로드 버튼 설정
        document.getElementById('download-btn').setAttribute('data-url', result.url);
        
        // 결과 섹션으로 스크롤
        document.getElementById('result-section').scrollIntoView({ behavior: 'smooth' });
        
        toastr.success('이미지가 성공적으로 병합되었습니다!');
    } catch (error) {
        console.error('이미지 병합 오류:', error);
        toastr.error('이미지 병합 중 오류가 발생했습니다: ' + error.message);
    } finally {
        // 로딩 오버레이 숨기기
        document.getElementById('loading-overlay').classList.add('hidden');
    }
}

// 병합된 이미지 다운로드
function downloadMergedImage() {
    const resultImage = document.getElementById('result-image');
    const imageUrl = resultImage.src;
    const outputFormat = document.getElementById('output-format').value.toLowerCase();
    
    // 다운로드 링크 생성
    const downloadLink = document.createElement('a');
    downloadLink.href = imageUrl;
    downloadLink.download = `merged_image_${new Date().getTime()}.${outputFormat}`;
    
    // 링크 클릭 및 제거
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    toastr.success('이미지 다운로드가 시작되었습니다.');
}

// 애플리케이션 초기화
function resetApplication() {
    // 업로드된 이미지 초기화
    uploadedImages = [];
    
    // UI 영역 초기화
    document.getElementById('images-container').innerHTML = '';
    document.getElementById('file-input').value = '';
    
    // 섹션 표시 상태 초기화
    document.getElementById('preview-section').classList.add('hidden');
    document.getElementById('result-section').classList.add('hidden');
    
    // 설정값 초기화
    document.getElementById('merge-direction').value = 'vertical';
    document.getElementById('image-spacing').value = '6';
    document.getElementById('alignment').value = 'left';
    document.getElementById('target-width').value = '550';
    document.getElementById('target-height').value = '800';
    document.getElementById('border-color').value = '#cccccc';
    document.getElementById('border-width').value = '1';
    document.getElementById('output-format').value = 'PNG';
    
    // 리사이징 옵션 업데이트
    updateResizeOptions();
    
    toastr.info('작업이 초기화되었습니다. 새 이미지를 업로드하세요.');
}
