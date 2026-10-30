import { getCollection, type CollectionEntry } from 'astro:content';
export type Post = CollectionEntry<'blog'>;
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.id.localeCompare(b.id));
}
export function getTags(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of new Set(post.data.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}
export const postUrl = (post: Post) => '/blog/' + post.id.split('/').map(encodeURIComponent).join('/') + '/';
export const tagUrl = (tag: string) => '/tags/' + encodeURIComponent(tag) + '/';
export const formatDate = (date: Date) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(date).replaceAll('/', '.');
export const readingTime = (body = '') => Math.max(1, Math.ceil(body.replace(/\x60{3}[\s\S]*?\x60{3}/g, '').length / 400));
