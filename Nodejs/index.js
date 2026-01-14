// ==================== TikTok Discord Bot - Replit Version ====================
// ==================== تم التطوير خصيصاً ليعمل على Replit ====================

// 1. استيراد المكتبات المطلوبة
const Discord = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const http = require('http'); // مهم: لإبقاء Replit نشطاً

// 2. التحقق من وجود المتغيرات المطلوبة
console.log('🔍 التحقق من الـ Secrets...');
const requiredEnvVars = ['DISCORD_TOKEN', 'TIKTOK_USERNAME', 'DISCORD_CHANNEL_ID'];
let missingVars = [];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        missingVars.push(envVar);
    }
}

if (missingVars.length > 0) {
    console.error('❌ أخطاء في الـ Secrets:');
    missingVars.forEach(varName => {
        console.error(`   - ${varName} غير موجود`);
    });
    console.log('\n📋 كيفية إضافة الـ Secrets في Replit:');
    console.log('1. انقر على أيقونة 🔓 Secrets في الشريط الأيسر');
    console.log('2. أضف هذه الـ Secrets:');
    console.log('   • DISCORD_TOKEN: توكن البوت من Discord');
    console.log('   • TIKTOK_USERNAME: اسم حساب TikTok');
    console.log('   • DISCORD_CHANNEL_ID: معرف القناة');
    console.log('3. انقر "Add secret" لكل واحد');
    console.log('4. أعد تشغيل البوت');
    process.exit(1);
}

// 3. تعريف المتغيرات من process.env (تأتي من Secrets)
const TIKTOK_USER = process.env.TIKTOK_USERNAME;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || '1';

console.log('✅ تم تحميل الـ Secrets بنجاح!');
console.log(`👤 حساب TikTok: @${TIKTOK_USER}`);
console.log(`📢 القناة: ${CHANNEL_ID}`);
console.log(`⏰ مدة الفحص: كل ${CHECK_INTERVAL} دقيقة`);

// 4. إنشاء عميل Discord
const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent
    ]
});

// 5. المتغيرات المهمة
let wasLive = false;
let botStartTime = new Date();

// 6. دالة فحص البث المباشر
async function checkLive() {
    try {
        console.log(`[${new Date().toLocaleTimeString()}] 🔍 جاري فحص حساب @${TIKTOK_USER}...`);

        // محاولة جلب بيانات TikTok
        const url = `https://www.tiktok.com/@${TIKTOK_USER}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // البحث عن مؤشرات البث المباشر
        const isLiveNow = html.includes('"status":2') || 
                         html.includes('"isLive":true') ||
                         html.includes('直播中') ||
                         $('*:contains("LIVE")').length > 0 ||
                         $('[data-e2e="live-badge"]').length > 0;

        if (isLiveNow && !wasLive) {
            console.log('🎬 تم اكتشاف بث مباشر جديد!');
            wasLive = true;

            // رابط البث المباشر
            const liveUrl = `https://www.tiktok.com/@${TIKTOK_USER}/live`;

            // محاولة استخراج عدد المشاهدين
            let viewerCount = null;
            const viewerMatch = html.match(/"userCount":(\d+)/) || html.match(/"viewerCount":(\d+)/);
            if (viewerMatch) {
                viewerCount = parseInt(viewerMatch[1]);
                console.log(`👥 عدد المشاهدين: ${viewerCount.toLocaleString()}`);
            }

            // إرسال الإشعار في Discord
            await sendLiveNotification(liveUrl, viewerCount);

        } else if (!isLiveNow && wasLive) {
            console.log('⏹️ البث المباشر انتهى');
            wasLive = false;
        }

    } catch (error) {
        console.log(`⚠️ حدث خطأ في الفحص: ${error.message}`);
        console.log('🔄 جاري المحاولة مرة أخرى في المرة القادمة...');
    }
}

// 7. دالة إرسال الإشعار
async function sendLiveNotification(liveUrl, viewerCount = null) {
    try {
        // البحث عن القناة
        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) {
            console.error('❌ لم أستطع العثور على القناة!');
            return;
        }

        // إنشاء رسالة جميلة
        const embed = new Discord.EmbedBuilder()
            .setColor('#FF0050') // لون TikTok
            .setTitle(`🎬 ${TIKTOK_USER} بدأ البث المباشر!`)
            .setDescription(`**انضم الآن إلى البث المباشر على TikTok**\n[اضغط هنا للمشاهدة](${liveUrl})`)
            .setThumbnail('https://i.imgur.com/5Q9B7yB.png') // شعار TikTok
            .setTimestamp()
            .setFooter({ 
                text: 'TikTok Live Bot | يعمل على Replit',
                iconURL: 'https://i.imgur.com/5Q9B7yB.png'
            });

        // إضافة حقل الرابط
        embed.addFields({
            name: '🔗 الرابط المباشر',
            value: liveUrl,
            inline: false
        });

        // إضافة عدد المشاهدين إذا وجد
        if (viewerCount) {
            embed.addFields({
                name: '👥 عدد المشاهدين',
                value: viewerCount.toLocaleString(),
                inline: true
            });
        }

        embed.addFields({
            name: '⏰ وقت الاكتشاف',
            value: new Date().toLocaleTimeString('ar-SA'),
            inline: true
        });

        // إرسال الرسالة مع منشن للكل
        await channel.send({
            content: `@everyone 🎬 **${TIKTOK_USER} يبث الآن على TikTok!**`,
            embeds: [embed]
        });

        console.log('✅ تم إرسال الإشعار بنجاح إلى الديسكورد!');

        // إضافة ردود فعل
        try {
            const messages = await channel.messages.fetch({ limit: 1 });
            const lastMessage = messages.first();
            if (lastMessage && lastMessage.author.id === client.user.id) {
                await lastMessage.react('🎬');
                await lastMessage.react('🔥');
                await lastMessage.react('👀');
            }
        } catch (reactionError) {
            console.log('⚠️ لم أستطع إضافة ردود الفعل');
        }

    } catch (error) {
        console.error('❌ خطأ في إرسال الإشعار:', error.message);
    }
}

// 8. عند تشغيل البوت
client.once('ready', () => {
    console.log('==========================================');
    console.log(`✅ البوت يعمل باسم: ${client.user.tag}`);
    console.log(`🆔 معرف البوت: ${client.user.id}`);
    console.log(`👤 يتم مراقبة حساب: @${TIKTOK_USER}`);
    console.log(`📢 الإشعارات ترسل في قناة: ${CHANNEL_ID}`);
    console.log(`⏰ مدة الفحص: كل ${CHECK_INTERVAL} دقيقة`);
    console.log('==========================================');

    // تغيير حالة البوت
    client.user.setPresence({
        activities: [{
            name: `@${TIKTOK_USER}`,
            type: Discord.ActivityType.Watching
        }],
        status: 'online'
    });

    // بدء الفحص الدوري
    const interval = parseInt(CHECK_INTERVAL) || 1;
    cron.schedule(`*/${interval} * * * *`, async () => {
        await checkLive();
    });

    console.log(`⏰ تم جدولة الفحص كل ${interval} دقيقة`);

    // فحص أولي عند التشغيل
    setTimeout(async () => {
        await checkLive();
    }, 3000);
});

// 9. أوامر للتحكم بالبوت
client.on('messageCreate', async (message) => {
    // تجاهل رسائل البوتات الأخرى
    if (message.author.bot) return;

    // الأمر: !تبق
    if (message.content === '!تبق') {
        const checkingMsg = await message.reply('🔍 جاري فحص البث المباشر...');
        await checkLive();

        if (wasLive) {
            await checkingMsg.edit(`✅ **يبث الآن!**\n🔗 https://www.tiktok.com/@${TIKTOK_USER}/live`);
        } else {
            await checkingMsg.edit('❌ لا يوجد بث مباشر حالياً.');
        }
    }

    // الأمر: !مساعدة
    if (message.content === '!مساعدة') {
        const helpEmbed = new Discord.EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('❓ مساعدة بوت TikTok')
            .setDescription('**الأوامر المتاحة:**')
            .addFields(
                { name: '!تبق', value: 'فحص يدوي للبث المباشر', inline: true },
                { name: '!مساعدة', value: 'عرض هذه الرسالة', inline: true },
                { name: '!رابط', value: 'رابط حساب TikTok', inline: true },
                { name: '!حالة', value: 'حالة البوت ووقت التشغيل', inline: true },
                { name: '!معلومات', value: 'معلومات عن البوت', inline: true }
            )
            .addFields({
                name: 'معلومات البوت',
                value: `🔍 يتم مراقبة: @${TIKTOK_USER}\n⏰ الفحص كل: ${CHECK_INTERVAL} دقيقة\n📢 القناة: <#${CHANNEL_ID}>`,
                inline: false
            })
            .setFooter({ text: 'يتم الفحص التلقائي كل دقيقة' });

        await message.reply({ embeds: [helpEmbed] });
    }

    // الأمر: !رابط
    if (message.content === '!رابط') {
        await message.reply(`🔗 رابط حساب TikTok: https://www.tiktok.com/@${TIKTOK_USER}`);
    }

    // الأمر: !حالة
    if (message.content === '!حالة') {
        const uptime = Math.floor((new Date() - botStartTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;

        const statusEmbed = new Discord.EmbedBuilder()
            .setColor(wasLive ? '#00FF00' : '#FF0000')
            .setTitle('📊 حالة البوت')
            .addFields(
                { name: '👤 الحساب المراقب', value: `@${TIKTOK_USER}`, inline: true },
                { name: '📡 حالة البث', value: wasLive ? '🟢 **يبث الآن**' : '🔴 **غير متصل**', inline: true },
                { name: '⏱️ وقت التشغيل', value: `${hours} ساعة ${minutes} دقيقة ${seconds} ثانية`, inline: false }
            )
            .setTimestamp();

        await message.reply({ embeds: [statusEmbed] });
    }

    // الأمر: !معلومات
    if (message.content === '!معلومات') {
        const infoEmbed = new Discord.EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🤖 معلومات البوت')
            .setDescription('بوت TikTok لإرسال إشعارات البث المباشر')
            .addFields(
                { name: '🛠️ المطور', value: 'تم التطوير بواسطة Eyad', inline: true },
                { name: '🌐 المنصة', value: 'Replit', inline: true },
                { name: '📚 المكتبات', value: 'discord.js, axios, cheerio', inline: true },
                { name: '⚙️ آلية العمل', value: 'يفحص TikTok كل دقيقة بحثاً عن البث المباشر', inline: false },
                { name: '🔔 المميزات', value: '• إشعارات تلقائية\n• منشن للكل\n• ردود فعل\n• أوامر تفاعلية', inline: false }
            )
            .setFooter({ text: 'يعمل 24/7 على Replit' });

        await message.reply({ embeds: [infoEmbed] });
    }
});

// 10. خادم ويب بسيط لإبقاء Replit نشطاً (هام جداً!)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'online',
        bot: client.user ? client.user.tag : 'starting...',
        tiktokUser: TIKTOK_USER,
        isLive: wasLive,
        uptime: Math.floor((new Date() - botStartTime) / 1000),
        lastCheck: new Date().toISOString(),
        message: 'TikTok Bot is running on Replit!'
    }));
});

// 11. بدء خادم الويب
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 خادم الويب يعمل على المنفذ: ${PORT}`);
    console.log(`🔗 الرابط الداخلي: http://localhost:${PORT}`);
    console.log(`🔄 يتم الحفاظ على نشاط Replit تلقائياً`);
});

// 12. تسجيل الدخول والتشغيل
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ خطأ في تسجيل الدخول:', error.message);
    console.log('\n🔍 تحقق من:');
    console.log('1. هل التوكن صحيح في Secrets؟');
    console.log('2. هل أعدت تعيين التوكن مؤخراً؟');
    console.log('3. هل البوت مضاف للسيرفر؟');
    console.log('4. هل التوكن مازال ساري المفعول؟');
    console.log('\n📋 خطوات التصحيح:');
    console.log('1. اذهب إلى Discord Developer Portal');
    console.log('2. اختر تطبيق TikTok Bot');
    console.log('3. انقر على Bot → Reset Token');
    console.log('4. انسخ التوكن الجديد');
    console.log('5. في Replit، عدل Secret DISCORD_TOKEN');
    console.log('6. أعد تشغيل البوت');

    process.exit(1);
});

// 13. معالجة الأخطاء
process.on('unhandledRejection', (error) => {
    console.error('❌ خطأ غير معالج:', error.message);
});

process.on('SIGINT', () => {
    console.log('🛑 إغلاق البوت...');
    client.destroy();
    server.close();
    process.exit(0);
});

// 14. رسالة البدء
console.log('\n🚀 بدء تشغيل بوت TikTok على Replit...');
console.log('⏳ يرجى الانتظار 5-10 ثوانٍ للاتصال بـ Discord\n');