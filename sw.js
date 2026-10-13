// Notifications only. Private pages, responses and documents are never cached.
self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('Family Hub', {
    body:'Eine Erinnerung wartet im Family Hub.',icon:'/knowledge-vault/icon-192.png',
    badge:'/knowledge-vault/icon-192.png',tag:'family-hub-reminder',data:{url:'/knowledge-vault/?open=health'},
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/knowledge-vault/?open=health'))
})
