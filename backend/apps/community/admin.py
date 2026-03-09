from django.contrib import admin
from .models import Category, Post, PostFile, Comment, Reaction, CommentReaction

# 게시글 내에서 첨부파일을 바로 관리할 수 있게 설정
class PostFileInline(admin.TabularInline):
    model = PostFile
    extra = 1

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'group', 'name', 'slug')
    list_filter = ('group',)
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)} # 이름 입력시 슬러그 자동 생성

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'author', 'category', 'is_anonymous', 'view_count', 'created_at')
    list_filter = ('category', 'is_anonymous', 'is_pinned', 'is_deleted')
    search_fields = ('title', 'content', 'author__email') # 유저 모델이 email을 쓴다면 author__email
    inlines = [PostFileInline] # 게시글 상세에서 파일 바로 업로드/삭제 가능
    raw_id_fields = ('author',) # 유저가 많을 경우 검색창으로 선택

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'post', 'author', 'is_anonymous', 'created_at')
    list_filter = ('is_anonymous', 'is_deleted')

# 좋아요 및 파일 모델 기본 등록
admin.site.register(PostFile)
admin.site.register(Reaction)
admin.site.register(CommentReaction)