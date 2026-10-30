import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import { getPublishedPosts, postUrl } from '../lib/posts';
export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({ title: SITE_TITLE, description: SITE_DESCRIPTION, site: context.site!, items: posts.map((post) => ({ title: post.data.title, pubDate: post.data.pubDate, description: post.data.description, link: postUrl(post), categories: post.data.tags })), customData: '<language>zh-cn</language>' });
}
