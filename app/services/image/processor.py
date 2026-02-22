"""
Image processor for original size support.

Handles image dimension detection, aspect ratio matching, and scaling.
"""

import io
from typing import Tuple

from PIL import Image


# Grok 支持的宽高比及其数值
SUPPORTED_RATIOS = {
    "1:1": 1.0,
    "16:9": 16 / 9,  # 1.778
    "9:16": 9 / 16,  # 0.5625
    "2:3": 2 / 3,  # 0.667
    "3:2": 3 / 2,  # 1.5
}

# 每个比例对应的标准目标尺寸
TARGET_SIZES = {
    "1:1": (1024, 1024),
    "16:9": (1536, 864),
    "9:16": (864, 1536),
    "2:3": (1024, 1536),
    "3:2": (1536, 1024),
}


class ImageProcessor:
    """图像处理器，用于支持原图尺寸功能。"""

    @staticmethod
    def get_dimensions(image_data: bytes) -> Tuple[int, int]:
        """
        获取图像的宽度和高度。

        Args:
            image_data: 图像的原始字节数据

        Returns:
            (width, height) 元组
        """
        with Image.open(io.BytesIO(image_data)) as img:
            return img.size

    @staticmethod
    def find_closest_ratio(width: int, height: int) -> str:
        """
        根据原图比例找到最接近的 Grok 支持比例。

        Args:
            width: 图像宽度
            height: 图像高度

        Returns:
            最接近的比例字符串，如 "3:2"
        """
        if height == 0:
            return "1:1"

        original_ratio = width / height
        closest_ratio = min(
            SUPPORTED_RATIOS.items(), key=lambda x: abs(x[1] - original_ratio)
        )
        return closest_ratio[0]

    @staticmethod
    def get_target_size(ratio: str) -> Tuple[int, int]:
        """
        根据比例返回标准目标尺寸。

        Args:
            ratio: 比例字符串，如 "3:2"

        Returns:
            (width, height) 元组
        """
        return TARGET_SIZES.get(ratio, (1024, 1024))

    @staticmethod
    def scale_image(
        image_data: bytes, target_width: int, target_height: int, output_format: str = "PNG"
    ) -> bytes:
        """
        使用 LANCZOS 算法将图像缩放到指定尺寸。

        Args:
            image_data: 图像的原始字节数据
            target_width: 目标宽度
            target_height: 目标高度
            output_format: 输出格式，默认 PNG

        Returns:
            缩放后的图像字节数据
        """
        with Image.open(io.BytesIO(image_data)) as img:
            # 保持原始模式，如果是 RGBA 则保留透明通道
            if img.mode in ("RGBA", "LA", "P"):
                # 如果输出格式不支持透明，转换为 RGB
                if output_format.upper() in ("JPEG", "JPG"):
                    img = img.convert("RGB")
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # 使用 LANCZOS 进行高质量缩放
            resized = img.resize((target_width, target_height), Image.Resampling.LANCZOS)

            # 输出到字节流
            output = io.BytesIO()
            save_format = output_format.upper()
            if save_format == "JPG":
                save_format = "JPEG"

            if save_format == "JPEG":
                resized.save(output, format=save_format, quality=95)
            else:
                resized.save(output, format=save_format)

            return output.getvalue()

    @staticmethod
    def scale_image_for_original(
        image_data: bytes,
    ) -> Tuple[bytes, str, Tuple[int, int]]:
        """
        为 original size 功能准备图像：检测尺寸、选择比例、缩放到标准尺寸。

        Args:
            image_data: 原始图像字节数据

        Returns:
            (scaled_image_data, aspect_ratio, original_size) 元组
        """
        # 获取原图尺寸
        original_size = ImageProcessor.get_dimensions(image_data)

        # 找到最接近的比例
        ratio = ImageProcessor.find_closest_ratio(*original_size)

        # 获取目标尺寸
        target_size = ImageProcessor.get_target_size(ratio)

        # 缩放图像
        scaled_data = ImageProcessor.scale_image(
            image_data, target_size[0], target_size[1]
        )

        return scaled_data, ratio, original_size
