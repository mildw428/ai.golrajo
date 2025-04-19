import base64
import io
import json
import os
import uuid
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import boto3

# 환경변수로 설정한 버킷 이름
BUCKET_NAME = os.environ.get("RESULT_BUCKET", "your-output-bucket")

s3 = boto3.client("s3")

def lambda_handler(event, context):
    try:
        body = json.loads(event["body"])
        images = body["images"]
        options = body["options"]
        
        # 화질 옵션 추출 (프론트엔드에서 추가 필요)
        quality = int(options.get("quality", 95))  # 기본 95% 품질
        enhance_factor = float(options.get("enhance", 1.0))  # 이미지 선명도 개선 계수
        
        pil_images = []

        for i, img_data in enumerate(images):
            image_bytes = base64.b64decode(img_data["base64"])
            img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
            
            # 이미지 화질 개선
            img = enhance_image_quality(img, enhance_factor)

            # 회전
            rotation = img_data.get("rotation", 0)
            if rotation:
                img = img.rotate(-rotation, expand=True, resample=Image.BICUBIC)  # 회전 시 BICUBIC 보간법 사용

            # 테두리 추가 (개별 이미지에)
            border_color = options.get("borderColor", "#cccccc")
            border_width = int(options.get("borderWidth", 0))
            if border_width > 0:
                img = add_border_to_image(img, border_color, border_width)

            pil_images.append(img)

        # 병합
        merged_image = merge_images(pil_images, options)
            
        # 최종 이미지 품질 개선
        merged_image = final_quality_enhancement(merged_image)

        # S3 업로드
        output_format = options.get("outputFormat", "PNG").upper()
        output_key = f"merged/{uuid.uuid4()}.{output_format.lower()}"
        buffer = io.BytesIO()
        
        # PNG와 같은 투명도를 지원하는 형식이 아니면 RGB로 변환
        if output_format != "PNG":
            merged_image = merged_image.convert("RGB")
            
        # 고품질 저장 옵션
        if output_format == "JPEG":
            merged_image.save(buffer, format=output_format, quality=quality, optimize=True, subsampling=0)
        elif output_format == "PNG":
            merged_image.save(buffer, format=output_format, optimize=True, compress_level=1)
        elif output_format == "WEBP":
            merged_image.save(buffer, format=output_format, quality=quality, method=6)  # method=6은 고품질 압축
        else:
            merged_image.save(buffer, format=output_format, quality=quality)
            
        buffer.seek(0)

        s3.upload_fileobj(
            buffer,
            BUCKET_NAME,
            output_key,
            ExtraArgs={
                "ContentType": f"image/{output_format.lower()}",
                "ContentDisposition": f'attachment; filename="merged-image.{output_format.lower()}"',
                "CacheControl": "max-age=300"  # 5분 캐싱
            }
        )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "url": f"https://{BUCKET_NAME}.s3.amazonaws.com/{output_key}"
            }),
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        }

    except Exception as e:
        print(f"Error processing images: {str(e)}")  # CloudWatch 로그에 오류 출력
        return {
            "statusCode": 500,
            "body": json.dumps({"detail": str(e)}),
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        }

def enhance_image_quality(image, factor=1.0):
    """이미지 화질 향상"""
    # 원본 크기의 2배로 업스케일링
    original_size = image.size
    upscaled_size = (original_size[0] * 2, original_size[1] * 2)
    
    # 고품질 업스케일링
    upscaled = image.resize(upscaled_size, Image.LANCZOS)
    
    # 선명도 개선
    if factor > 1.0:
        enhancer = ImageEnhance.Sharpness(upscaled)
        upscaled = enhancer.enhance(factor)
    
    # 원본 크기로 다시 조정 (더 높은 품질의 다운샘플링)
    return upscaled.resize(original_size, Image.LANCZOS)

def final_quality_enhancement(image):
    """최종 병합 이미지 품질 개선"""
    # 약간의 언샤프 마스크로 디테일 향상
    enhanced = image.filter(ImageFilter.UnsharpMask(radius=1.0, percent=150, threshold=3))
    
    # 약간의 대비 향상
    enhancer = ImageEnhance.Contrast(enhanced)
    enhanced = enhancer.enhance(1.1)  # 10% 대비 증가
    
    return enhanced

def add_border_to_image(image, border_color, border_width):
    """이미지에 테두리 추가"""
    width, height = image.size
    new_width = width + 2 * border_width
    new_height = height + 2 * border_width
    
    # 테두리 색 추출 (RGB 또는 RGBA)
    if border_color.startswith('#'):
        # HEX 색상 변환
        r = int(border_color[1:3], 16)
        g = int(border_color[3:5], 16)
        b = int(border_color[5:7], 16)
        
        if len(border_color) > 7:  # RGBA 색상인 경우
            a = int(border_color[7:9], 16) if len(border_color) > 7 else 255
            border_fill = (r, g, b, a)
        else:
            border_fill = (r, g, b, 255)
    else:
        border_fill = border_color
    
    bordered_image = Image.new("RGBA", (new_width, new_height), border_fill)
    bordered_image.paste(image, (border_width, border_width), image if image.mode == 'RGBA' else None)
    
    return bordered_image

def merge_images(images, options):
    """이미지 병합"""
    direction = options.get("direction", "vertical")
    spacing = int(options.get("spacing", 6))
    alignment = options.get("alignment", "left")
    target_width = int(options.get("targetWidth", 550))
    target_height = int(options.get("targetHeight", 800))
    
    # 고품질 보간법 옵션
    resample_method = Image.LANCZOS  # 가장 고품질의 리샘플링 방법

    # 리사이징
    resized_images = []
    for img in images:
        if direction == "vertical":
            # 너비를 기준으로 비율 유지하여 리사이징
            w_percent = (target_width / float(img.size[0]))
            h_size = int((float(img.size[1]) * float(w_percent)))
            resized = img.resize((target_width, h_size), resample_method)
        else:  # horizontal or horizontal_2x
            # 높이를 기준으로 비율 유지하여 리사이징
            h_percent = (target_height / float(img.size[1]))
            w_size = int((float(img.size[0]) * float(h_percent)))
            resized = img.resize((w_size, target_height), resample_method)
        resized_images.append(resized)

    # 병합용 캔버스 크기 계산
    widths, heights = zip(*(img.size for img in resized_images))

    # 배경색 설정 (프론트엔드에서 옵션 추가 필요)
    background_color = options.get("backgroundColor", (255, 255, 255, 0))  # 기본 투명 배경
    
    if direction == "vertical":
        total_width = max(widths)
        total_height = sum(heights) + spacing * (len(images) - 1)
        merged_img = Image.new("RGBA", (total_width, total_height), background_color)
        y_offset = 0
        
        for img in resized_images:
            # 정렬 옵션 적용
            if alignment == "left":
                x_pos = 0
            elif alignment == "center":
                x_pos = (total_width - img.size[0]) // 2
            else:  # right
                x_pos = total_width - img.size[0]
                
            merged_img.paste(img, (x_pos, y_offset), img if img.mode == 'RGBA' else None)
            y_offset += img.size[1] + spacing
            
    elif direction == "horizontal_2x":
        # 가로 2개씩 병합 구현
        # 이미지를 2열로 배치
        max_height_per_row = []
        row_count = (len(images) + 1) // 2  # 이미지를 2개씩 배치할 때 필요한 행 수
        
        # 각 행의 최대 높이 계산
        for i in range(row_count):
            row_images = resized_images[i*2:i*2+2]
            max_height_per_row.append(max([img.size[1] for img in row_images] or [0]))
        
        total_height = sum(max_height_per_row) + spacing * (row_count - 1)
        
        # 각 열의 최대 너비 계산 (균일하지 않을 수 있음)
        max_width_col1 = max([resized_images[i*2].size[0] if i*2 < len(resized_images) else 0 for i in range(row_count)])
        max_width_col2 = max([resized_images[i*2+1].size[0] if i*2+1 < len(resized_images) else 0 for i in range(row_count)])
        
        total_width = max_width_col1 + max_width_col2 + spacing
        
        merged_img = Image.new("RGBA", (total_width, total_height), background_color)
        
        y_offset = 0
        for i in range(row_count):
            row_images = resized_images[i*2:i*2+2]
            row_height = max_height_per_row[i]
            
            x_offset = 0
            for j, img in enumerate(row_images):
                # 각 이미지의 수직 위치 계산 (중앙 정렬)
                y_pos = y_offset + (row_height - img.size[1]) // 2
                
                # 정렬 옵션 적용 (가로 2개 모드에서는 각 열 내에서도 정렬 가능)
                if alignment == "left":
                    x_pos = x_offset
                elif alignment == "center":
                    # 각 열의 최대 너비를 기준으로 중앙 정렬
                    col_width = max_width_col1 if j == 0 else max_width_col2
                    x_pos = x_offset + (col_width - img.size[0]) // 2
                else:  # right
                    col_width = max_width_col1 if j == 0 else max_width_col2
                    x_pos = x_offset + col_width - img.size[0]
                
                merged_img.paste(img, (x_pos, y_pos), img if img.mode == 'RGBA' else None)
                
                # 다음 열로 이동
                x_offset += (max_width_col1 if j == 0 else 0) + spacing
                
            y_offset += row_height + spacing
            
    else:  # horizontal
        total_height = max(heights)
        total_width = sum(widths) + spacing * (len(images) - 1)
        merged_img = Image.new("RGBA", (total_width, total_height), background_color)
        
        x_offset = 0
        for img in resized_images:
            # 정렬 옵션 적용
            if alignment == "left" or alignment == "center":  # 가로 모드에서 center는 top과 동일하게 처리
                y_pos = 0
            else:  # right (bottom)
                y_pos = total_height - img.size[1]
                
            merged_img.paste(img, (x_offset, y_pos), img if img.mode == 'RGBA' else None)
            x_offset += img.size[0] + spacing

    return merged_img