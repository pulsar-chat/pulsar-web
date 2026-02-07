import { UserProfile } from "./types";
import { PulsarClient } from "./client";

/**
 * Загружает профиль пользователя с сервера
 */
export async function loadUserProfileFromServer(
    cli: PulsarClient
): Promise<UserProfile> {
    const profile: UserProfile = {};
    
    try {
        const rsp = await cli.requestRaw("!profile get");
        
        if (rsp && rsp !== '-') {
            // Парсим формат профиля: description \x1D email \x1D realName \x1D birthday
            const fields = rsp.split('\u001D');
            if (fields[0]) profile.description = fields[0];
            if (fields[1]) profile.email = fields[1];
            if (fields[2]) profile.realName = fields[2];
            if (fields[3]) profile.birthday = parseInt(fields[3]);
        }
    } catch (err) {
        console.error('Failed to load profile from server:', err);
    }
    
    return profile;
}

/**
 * Сохраняет профиль на сервер
 */
export async function saveProfileToServer(
    cli: PulsarClient,
    profileData: {
        description?: string;
        email?: string;
        realName?: string;
        birthday?: string;
    }
): Promise<boolean> {
    try {
        const profile = [
            profileData.description || '',
            profileData.email || '',
            profileData.realName || '',
            profileData.birthday || ''
        ].join('\u001D');
        
        const rsp = await cli.requestRaw(`!profile set ${profile}`);
        return rsp === 'success' || rsp === 'ok';
    } catch (err) {
        console.error('Profile save error:', err);
        return false;
    }
}

/**
 * Форматирует дату рождения для отображения
 */
export function formatBirthday(timestamp?: number): string {
    if (!timestamp) return 'Не указано';
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ru-RU');
}
