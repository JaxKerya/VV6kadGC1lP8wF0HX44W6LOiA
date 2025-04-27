const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Sezar şifreleme/deşifreleme fonksiyonları
function sezarSifrele(metin, kaydirma) {
    let sonuc = '';
    for (let i = 0; i < metin.length; i++) {
        let karakter = metin[i];
        
        // Büyük harf ise
        if (karakter.match(/[A-Z]/)) {
            sonuc += String.fromCharCode((karakter.charCodeAt(0) - 65 + kaydirma) % 26 + 65);
        }
        // Küçük harf ise
        else if (karakter.match(/[a-z]/)) {
            sonuc += String.fromCharCode((karakter.charCodeAt(0) - 97 + kaydirma) % 26 + 97);
        }
        // Sayı veya özel karakter ise olduğu gibi bırak
        else {
            sonuc += karakter;
        }
    }
    return sonuc;
}

function sezarDesifrele(sifreliMetin, kaydirma) {
    // Negatif kaydırma kullanarak deşifrele
    return sezarSifrele(sifreliMetin, 26 - (kaydirma % 26));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
});

// Bot token ve client id bilgileri - şifrelenmiş
const SIFRELI_TOKEN = 'NUN2OUl4OkV3NUlzPEdaNUZ2PR.HuYVjz.nQUL4I8mSewPnhXLviSlFiZ-mS_ZwIqQ7SYuml'; // Bu kısım şifrelenecek
const SIFRELEME_ANAHTARI = 1; // Sezar şifreleme için kullanılacak kaydırma miktarı
const TOKEN = sezarDesifrele(SIFRELI_TOKEN, SIFRELEME_ANAHTARI);
const CLIENT_ID = '1365986571928731669';
const GUILD_ID = '1364220759332880474';

// Veritabanı dosya yolu
const DB_PATH = path.join(__dirname, 'veritabani.json');

// Veritabanı nesnesi
let db = {
    alınacakRol: null,
    verilecekRol: null,
    hoşGeldinKanalı: null
};

// Veritabanını yükle
function veritabanıYükle() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            db = JSON.parse(data);
            console.log('Veritabanı başarıyla yüklendi.');
        } else {
            // Veritabanı dosyası yoksa oluştur
            veritabanıKaydet();
            console.log('Yeni veritabanı dosyası oluşturuldu.');
        }
    } catch (error) {
        console.error('Veritabanı yüklenirken hata:', error);
    }
}

// Veritabanını kaydet
function veritabanıKaydet() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
        console.log('Veritabanı başarıyla kaydedildi.');
    } catch (error) {
        console.error('Veritabanı kaydedilirken hata:', error);
    }
}

// Komutları ayarla
const commands = [
    new SlashCommandBuilder()
        .setName('kayıt')
        .setDescription('Bir kullanıcıyı kayıt eder.')
        .addUserOption(option =>
            option.setName('kullanıcı')
                  .setDescription('Kayıt edilecek kullanıcıyı seçin')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('kayıt-ayarla')
        .setDescription('Kayıt için alınacak ve verilecek rolleri ayarlar.')
        .addRoleOption(option =>
            option.setName('alınacak_rol')
                  .setDescription('Kullanıcıdan alınacak rolü seçin')
                  .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('verilecek_rol')
                  .setDescription('Kullanıcıya verilecek rolü seçin')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('hoşgeldin-kanal-ayarla')
        .setDescription('Hoş geldin mesajlarının gönderileceği kanalı ayarlar.')
        .addChannelOption(option =>
            option.setName('kanal')
                  .setDescription('Hoş geldin mesajlarının gönderileceği kanalı seçin')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('ayarlar')
        .setDescription('Mevcut bot ayarlarını gösterir.'),
];

// Komutları Discord'a yükle
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Slash komutlar yükleniyor...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('Slash komutlar başarıyla yüklendi.');
        console.log('Guncel');
    } catch (error) {
        console.error(error);
    }
})();

// Kullanıcı kaydetme fonksiyonu
async function kullanıcıKaydet(member, interaction = null) {
    try {
        // Veritabanından rol bilgilerini al
        const alınacakRolId = db.alınacakRol;
        const verilecekRolId = db.verilecekRol;
        
        // Bot izinlerini kontrol et
        const botMember = member.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const hataMsg = 'Bot, rolleri yönetme iznine sahip değil!';
            console.error(hataMsg);
            
            if (interaction) {
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Hata')
                    .setDescription(hataMsg)
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [errorEmbed], 
                    components: [disabledRow]
                });
            }
            return false;
        }
        
        // Rol işlemleri
        let rolDegistiMesaji = '';
        
        if (alınacakRolId) {
            const alınacakRol = member.guild.roles.cache.get(alınacakRolId);
            
            if (alınacakRol) {
                // Botun rol hiyerarşisini kontrol et
                if (botMember.roles.highest.position <= alınacakRol.position) {
                    const hataMsg = `Botun rolü, alınacak rolden (${alınacakRol.name}) daha düşük pozisyonda!`;
                    console.error(hataMsg);
                    
                    if (interaction) {
                        // Devre dışı butonlar
                        const disabledRow = new ActionRowBuilder()
                            .addComponents(
                                ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                                ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                                ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                            );
                        
                        const errorEmbed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('Hata')
                            .setDescription(hataMsg)
                            .setTimestamp();
                        
                        return interaction.update({ 
                            embeds: [errorEmbed], 
                            components: [disabledRow]
                        });
                    }
                    return false;
                }
                
                // Kullanıcının alınacak role sahip olup olmadığını kontrol et
                if (member.roles.cache.has(alınacakRolId)) {
                    console.log(`${member.user.tag} kullanıcısından ${alınacakRol.name} rolü alınıyor...`);
                    await member.roles.remove(alınacakRolId);
                    console.log(`${member.user.tag} kullanıcısından ${alınacakRol.name} rolü alındı.`);
                    rolDegistiMesaji += `• ${alınacakRol.name} rolü alındı.\n`;
                } else {
                    console.log(`${member.user.tag} kullanıcısında ${alınacakRol.name} rolü zaten yok.`);
                }
            } else {
                console.error(`Alınacak rol (ID: ${alınacakRolId}) bulunamadı!`);
            }
        }
        
        if (verilecekRolId) {
            const verilecekRol = member.guild.roles.cache.get(verilecekRolId);
            
            if (verilecekRol) {
                // Botun rol hiyerarşisini kontrol et
                if (botMember.roles.highest.position <= verilecekRol.position) {
                    const hataMsg = `Botun rolü, verilecek rolden (${verilecekRol.name}) daha düşük pozisyonda!`;
                    console.error(hataMsg);
                    
                    if (interaction) {
                        // Devre dışı butonlar
                        const disabledRow = new ActionRowBuilder()
                            .addComponents(
                                ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                                ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                                ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                            );
                        
                        const errorEmbed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('Hata')
                            .setDescription(hataMsg)
                            .setTimestamp();
                        
                        return interaction.update({ 
                            embeds: [errorEmbed], 
                            components: [disabledRow]
                        });
                    }
                    return false;
                }
                
                // Kullanıcının verilecek role zaten sahip olup olmadığını kontrol et
                if (!member.roles.cache.has(verilecekRolId)) {
                    console.log(`${member.user.tag} kullanıcısına ${verilecekRol.name} rolü veriliyor...`);
                    await member.roles.add(verilecekRolId);
                    console.log(`${member.user.tag} kullanıcısına ${verilecekRol.name} rolü verildi.`);
                    rolDegistiMesaji += `• ${verilecekRol.name} rolü verildi.\n`;
                } else {
                    console.log(`${member.user.tag} kullanıcısı zaten ${verilecekRol.name} rolüne sahip.`);
                }
            } else {
                console.error(`Verilecek rol (ID: ${verilecekRolId}) bulunamadı!`);
            }
        }
        
        if (interaction) {
            // Devre dışı butonlar
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                    ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                    ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                );
            
            // Başarılı kayıt için güncelleme embedini oluştur
            const updatedEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Kayıt Tamamlandı')
                .setDescription(`${member} kullanıcısı ${interaction.user} tarafından kayıt edildi.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            
            if (rolDegistiMesaji.length > 0) {
                updatedEmbed.addFields({ name: 'Rol Değişiklikleri', value: rolDegistiMesaji });
            }
                
            return interaction.update({ 
                embeds: [updatedEmbed], 
                components: [disabledRow]
            });
        }
        
        return true;
    } catch (error) {
        console.error('Kullanıcı kaydedilirken hata:', error);
        
        if (interaction) {
            // Devre dışı butonlar
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                    ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                    ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                );
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Hata')
                .setDescription(`Rol değiştirirken bir hata oluştu: ${error.message}`)
                .setTimestamp();
            
            return interaction.update({ 
                embeds: [errorEmbed], 
                components: [disabledRow]
            });
        }
        
        return false;
    }
}

// Bot olayları
client.on('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı.`);
    // Bot başlatıldığında veritabanını yükle
    veritabanıYükle();
    
    // Botun iznini kontrol et
    client.guilds.cache.forEach(guild => {
        console.log(`Sunucu: ${guild.name}`);
        const botMember = guild.members.me;
        if (botMember) {
            if (botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                console.log('✅ Bot, rolleri yönetme iznine sahip.');
            } else {
                console.log('❌ UYARI: Bot, rolleri yönetme iznine sahip değil!');
            }
            
            // Botun rol hiyerarşisini kontrol et
            if (db.alınacakRol || db.verilecekRol) {
                const alınacakRol = db.alınacakRol ? guild.roles.cache.get(db.alınacakRol) : null;
                const verilecekRol = db.verilecekRol ? guild.roles.cache.get(db.verilecekRol) : null;
                const botRol = botMember.roles.highest;
                
                if (alınacakRol && botRol.position <= alınacakRol.position) {
                    console.log(`❌ UYARI: Botun rolü (${botRol.name}), alınacak rolden (${alınacakRol.name}) daha düşük pozisyonda!`);
                }
                
                if (verilecekRol && botRol.position <= verilecekRol.position) {
                    console.log(`❌ UYARI: Botun rolü (${botRol.name}), verilecek rolden (${verilecekRol.name}) daha düşük pozisyonda!`);
                }
            }
        }
    });
});

// Yeni kullanıcı sunucuya katıldığında çalışacak olay
client.on(Events.GuildMemberAdd, async (member) => {
    console.log(`Yeni kullanıcı: ${member.user.tag} sunucuya katıldı.`);
    
    // Veritabanından ayarları kontrol et
    if (!db.hoşGeldinKanalı || !db.alınacakRol || !db.verilecekRol) {
        console.log('Hoş geldin ayarları tamamlanmamış. Yeni üye için mesaj gönderilmeyecek.');
        return; // Gerekli ayarlar henüz yapılmamış
    }
    
    const kanal = member.guild.channels.cache.get(db.hoşGeldinKanalı);
    if (!kanal) {
        console.log(`Hoş geldin kanalı (ID: ${db.hoşGeldinKanalı}) bulunamadı!`);
        return;
    }
    
    console.log(`${member.user.tag} için ${kanal.name} kanalına hoş geldin mesajı gönderiliyor...`);
    
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Yeni Kullanıcı Katıldı!')
        .setDescription(`${member} sunucuya katıldı. Ne yapmak istersiniz?`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`kaydet_${member.id}`)
                .setLabel('Kaydet')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`at_${member.id}`)
                .setLabel('At')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`banla_${member.id}`)
                .setLabel('Banla')
                .setStyle(ButtonStyle.Danger),
        );
    
    await kanal.send({ embeds: [embed], components: [row] })
        .then(() => console.log(`${member.user.tag} için hoş geldin mesajı gönderildi.`))
        .catch(err => console.error(`Hoş geldin mesajı gönderilirken hata:`, err));
});

client.on('interactionCreate', async interaction => {
    // Buton etkileşimlerini işle
    if (interaction.isButton()) {
        const [action, userId] = interaction.customId.split('_');
        
        if (action === 'kaydet') {
            if (!db.alınacakRol || !db.verilecekRol) {
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Hata')
                    .setDescription('Roller henüz ayarlanmamış!')
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [errorEmbed], 
                    components: [disabledRow]
                });
            }
            
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            
            if (!member) {
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Hata')
                    .setDescription('Kullanıcı bulunamadı.')
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [errorEmbed], 
                    components: [disabledRow]
                });
            }
            
            await kullanıcıKaydet(member, interaction);
        } 
        else if (action === 'at') {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            
            if (!member) {
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Hata')
                    .setDescription('Kullanıcı bulunamadı veya zaten sunucudan ayrılmış.')
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [errorEmbed], 
                    components: [disabledRow]
                });
            }
            
            try {
                // Bot izinlerini kontrol et
                const botMember = interaction.guild.members.me;
                if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
                    // Devre dışı butonlar
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                            ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                            ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                        );
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Hata')
                        .setDescription('Bot, üyeleri atma iznine sahip değil!')
                        .setTimestamp();
                    
                    return interaction.update({ 
                        embeds: [errorEmbed], 
                        components: [disabledRow]
                    });
                }
                
                // Kullanıcıyı sunucudan at
                console.log(`${member.user.tag} kullanıcısı sunucudan atılıyor...`);
                await member.kick(`${interaction.user.tag} tarafından atıldı.`);
                
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const kickEmbed = new EmbedBuilder()
                    .setColor(0xFF9900)
                    .setTitle('Kullanıcı Atıldı')
                    .setDescription(`${member.user.tag} kullanıcısı ${interaction.user} tarafından sunucudan atıldı.`)
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [kickEmbed], 
                    components: [disabledRow]
                });
            } catch (error) {
                console.error('Kullanıcı atılırken hata:', error);
                
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Hata')
                    .setDescription(`Kullanıcı atılırken bir hata oluştu: ${error.message}`)
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [errorEmbed], 
                    components: [disabledRow]
                });
            }
        }
        else if (action === 'banla') {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            
            if (!member) {
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Hata')
                    .setDescription('Kullanıcı bulunamadı veya zaten sunucudan ayrılmış.')
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [errorEmbed], 
                    components: [disabledRow]
                });
            }
            
            try {
                // Bot izinlerini kontrol et
                const botMember = interaction.guild.members.me;
                if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
                    // Devre dışı butonlar
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                            ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                            ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                        );
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Hata')
                        .setDescription('Bot, üyeleri banlama iznine sahip değil!')
                        .setTimestamp();
                    
                    return interaction.update({ 
                        embeds: [errorEmbed], 
                        components: [disabledRow]
                    });
                }
                
                // Kullanıcıyı sunucudan banla
                console.log(`${member.user.tag} kullanıcısı sunucudan banlanıyor...`);
                await member.ban({
                    reason: `${interaction.user.tag} tarafından banlandı.`,
                    deleteMessageSeconds: 60 * 60 * 24 // Son 24 saatteki mesajları sil
                });
                
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const banEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Kullanıcı Banlandı')
                    .setDescription(`${member.user.tag} kullanıcısı ${interaction.user} tarafından sunucudan banlandı.`)
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [banEmbed], 
                    components: [disabledRow]
                });
            } catch (error) {
                console.error('Kullanıcı banlanırken hata:', error);
                
                // Devre dışı butonlar
                const disabledRow = new ActionRowBuilder()
                    .addComponents(
                        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
                        ButtonBuilder.from(interaction.message.components[0].components[2]).setDisabled(true)
                    );
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Hata')
                    .setDescription(`Kullanıcı banlanırken bir hata oluştu: ${error.message}`)
                    .setTimestamp();
                
                return interaction.update({ 
                    embeds: [errorEmbed], 
                    components: [disabledRow]
                });
            }
        }
        
        return;
    }

    // Slash komut etkileşimlerini işle
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'kayıt') {
        if (!db.alınacakRol || !db.verilecekRol) {
            return interaction.reply({ content: 'Önce `/kayıt-ayarla` komutuyla roller ayarlanmalı!', ephemeral: true });
        }

        const hedef = interaction.options.getUser('kullanıcı');
        const member = await interaction.guild.members.fetch(hedef.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'Belirtilen kullanıcı bulunamadı.', ephemeral: true });
        }

        try {
            await kullanıcıKaydet(member);
            await interaction.reply({ content: `${member} başarıyla kayıt edildi! 🎉`, ephemeral: false });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Rol değiştirirken bir hata oluştu.', ephemeral: true });
        }
    }
    else if (interaction.commandName === 'kayıt-ayarla') {
        try {
            const alınacakRol = interaction.options.getRole('alınacak_rol');
            const verilecekRol = interaction.options.getRole('verilecek_rol');
            
            // Veritabanında rolleri güncelle
            db.alınacakRol = alınacakRol.id;
            db.verilecekRol = verilecekRol.id;
            veritabanıKaydet();
            
            await interaction.reply({ 
                content: `Roller ayarlandı!\nAlınacak rol: ${alınacakRol}\nVerilecek rol: ${verilecekRol}`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Rol ayarlama hatası:', error);
            // Eğer etkileşim henüz yanıtlanmadıysa yanıtla
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Roller ayarlanırken bir hata oluştu.', 
                    ephemeral: true 
                });
            }
        }
    }
    else if (interaction.commandName === 'hoşgeldin-kanal-ayarla') {
        try {
            const kanal = interaction.options.getChannel('kanal');
            
            // Veritabanında kanalı güncelle
            db.hoşGeldinKanalı = kanal.id;
            veritabanıKaydet();
            
            await interaction.reply({ 
                content: `Hoş geldin kanalı ${kanal} olarak ayarlandı!`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Kanal ayarlama hatası:', error);
            // Eğer etkileşim henüz yanıtlanmadıysa yanıtla
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Hoş geldin kanalı ayarlanırken bir hata oluştu.', 
                    ephemeral: true 
                });
            }
        }
    }
    else if (interaction.commandName === 'ayarlar') {
        try {
            let mesaj = '**Mevcut Bot Ayarları**\n\n';
            
            if (db.alınacakRol) {
                const rol = interaction.guild.roles.cache.get(db.alınacakRol);
                mesaj += `**Alınacak Rol:** ${rol ? rol.name : 'Bulunamadı'} (ID: ${db.alınacakRol})\n`;
            } else {
                mesaj += '**Alınacak Rol:** Ayarlanmamış\n';
            }
            
            if (db.verilecekRol) {
                const rol = interaction.guild.roles.cache.get(db.verilecekRol);
                mesaj += `**Verilecek Rol:** ${rol ? rol.name : 'Bulunamadı'} (ID: ${db.verilecekRol})\n`;
            } else {
                mesaj += '**Verilecek Rol:** Ayarlanmamış\n';
            }
            
            if (db.hoşGeldinKanalı) {
                const kanal = interaction.guild.channels.cache.get(db.hoşGeldinKanalı);
                mesaj += `**Hoş Geldin Kanalı:** ${kanal ? kanal.name : 'Bulunamadı'} (ID: ${db.hoşGeldinKanalı})\n`;
            } else {
                mesaj += '**Hoş Geldin Kanalı:** Ayarlanmamış\n';
            }
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Bot Ayarları')
                .setDescription(mesaj)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Ayarlar gösterilirken hata:', error);
            await interaction.reply({ 
                content: 'Ayarlar gösterilirken bir hata oluştu.', 
                ephemeral: true 
            });
        }
    }
});

// Botu başlat
client.login(TOKEN);

// Token şifreleme örneği - bu kısım sadece tokeni şifrelemek için
// GitHub'a yüklemeden önce kaldırın veya yorum satırı haline getirin
// Aşağıdaki kod, orijinal tokeninizi şifreli hale getirecek
console.log('----- TOKEN ŞİFRELEME BİLGİLERİ (GitHub\'a yüklemeden önce bu kısmı silin) -----');
console.log('Orijinal Token: ' + SIFRELI_TOKEN);
console.log('Şifreleme Anahtarı: ' + SIFRELEME_ANAHTARI);
console.log('Şifrelenmiş Token: ' + sezarSifrele(SIFRELI_TOKEN, SIFRELEME_ANAHTARI));
console.log('---------------------------------------------------------------------------------');
