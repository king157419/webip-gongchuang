"""上海大学人工智能社官网管理后台。

用法（serve.py 里）：
    from club_admin import install
    install(app)          # 必须在挂载 /shared 等静态目录之前
"""
__version__ = "1.0.0"


def install(app, settings=None):  # 延迟导入：CLI 不需要加载 FastAPI
    from .web import install as _install
    return _install(app, settings)
