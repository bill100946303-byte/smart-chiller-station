import defaultSettings from '@/settings'

const title = defaultSettings.title || '冷站智慧管理平台'

export default function getPageTitle(pageTitle) {
  if (pageTitle) {
    return `${pageTitle} - ${title}`
  }
  return `${title}`
}
