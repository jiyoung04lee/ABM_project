from django.contrib import admin
from .models import Category, Post, PostFile, Comment, Reaction, CommentReaction

# 게시글 상세 페이지에서 첨부파일을 바로 관리할 수 있게 설정
class PostFileInline(admin.TabularInline):
    model = PostFile
    extra = 1

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'type', 'name', 'slug')
    list_filter = ('type',)
    search_fields = ('name', 'slug')

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    # 관리자 목록에 표시될 필드들
    list_display = ('id', 'type', 'category', 'title', 'author', 'view_count', 'created_at')
    # 우측 필터 바 설정
    list_filter = ('type', 'category', 'is_pinned', 'is_deleted')
    # 검색 기능 (제목, 내용, 작성자 이메일)
    search_fields = ('title', 'content', 'author__email')
    # 첨부파일 인라인 추가
    inlines = [PostFileInline]
    # 작성자 선택 시 검색창 사용 (유저가 많을 때 유용)
    raw_id_fields = ('author',)

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'author', 'like_count', 'created_at')
    list_filter = ('is_deleted',)
    search_fields = ('content', 'author__email')

# 좋아요 및 파일 모델 기본 등록
admin.site.register(PostFile)
admin.site.register(Reaction)
admin.site.register(CommentReaction)