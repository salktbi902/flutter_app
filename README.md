# Android AI Studio 🤖

تطبيق ذكاء اصطناعي متكامل لنظام Android، يتصل بسيرفر AI خاص ويوفر محادثة ذكية، بناء تطبيقات No-Code، وتيرمنال تفاعلي.

## المميزات

- **💬 محادثة AI** - محادثة ذكية مع ذاكرة سياقية
- **🛠️ No-Code Builder** - بناء تطبيقات بوصف نصي
- **💻 Terminal** - تنفيذ أوامر مباشرة على السيرفر
- **⚙️ إعدادات** - مراقبة حالة السيرفر والخدمات

## السيرفر

| الخدمة | الحالة |
|--------|--------|
| API | `http://76.13.213.128:3000` |
| WebSocket | `ws://76.13.213.128:3000` |
| Redis | متصل |
| Pinecone | متصل |
| OpenAI | مُهيأ |

## البناء

### GitHub Actions (تلقائي)
1. ادخل **Actions** في هذا المستودع
2. اضغط **Build Flutter APK**
3. اضغط **Run workflow**
4. انتظر 10 دقائق
5. حمّل APK من **Artifacts**

### يدوياً
```bash
flutter pub get
flutter build apk --release
```

## API Endpoints

| Endpoint | الوصف |
|----------|-------|
| `/health` | فحص حالة السيرفر |
| `/api/v1/ai/chat` | محادثة AI |
| `/api/v1/ai/execute` | تنفيذ أوامر |
| `/api/v1/ai/generate-ui` | توليد واجهات |
| `/api/v1/ai/memory/search` | بحث في الذاكرة |

## الإصدار

**v2.0.0** - Android AI Studio

---
**المطور:** salktbi902
