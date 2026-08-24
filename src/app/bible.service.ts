import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, collection, doc, setDoc, query, orderBy, getDocs, updateDoc, increment, arrayUnion, getDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BibleService {
  private bibleData: any = null;

  // 성경 리스트 (약어 및 장 수)
  public BIBLE_LIST = [
  // 구약성경 (39권)
  { name: '창세기', abbr: '창', chapters: 50 },
  { name: '출애굽기', abbr: '출', chapters: 40 },
  { name: '레위기', abbr: '레', chapters: 27 },
  { name: '민수기', abbr: '민', chapters: 36 },
  { name: '신명기', abbr: '신', chapters: 34 },
  { name: '여호수아', abbr: '수', chapters: 24 },
  { name: '사사기', abbr: '삿', chapters: 21 },
  { name: '루기', abbr: '룻', chapters: 4 },
  { name: '사무엘상', abbr: '삼상', chapters: 31 },
  { name: '사무엘하', abbr: '삼하', chapters: 24 },
  { name: '열왕기상', abbr: '왕상', chapters: 22 },
  { name: '열왕기하', abbr: '왕하', chapters: 25 },
  { name: '역대상', abbr: '대상', chapters: 29 },
  { name: '역대하', abbr: '대하', chapters: 36 },
  { name: '에스라', abbr: '라', chapters: 10 },
  { name: '느헤미야', abbr: '느', chapters: 13 },
  { name: '에스더', abbr: '더', chapters: 10 },
  { name: '욥기', abbr: '욥', chapters: 42 },
  { name: '시편', abbr: '시', chapters: 150 },
  { name: '잠언', abbr: '잠', chapters: 31 },
  { name: '전도서', abbr: '전', chapters: 12 },
  { name: '아가', abbr: '아', chapters: 8 },
  { name: '이사야', abbr: '사', chapters: 66 },
  { name: '예레미야', abbr: '렘', chapters: 52 },
  { name: '예레미야 애가', abbr: '애', chapters: 5 },
  { name: '에스겔', abbr: '겔', chapters: 48 },
  { name: '다니엘', abbr: '단', chapters: 12 },
  { name: '호세아', abbr: '호', chapters: 14 },
  { name: '요엘', abbr: '욜', chapters: 3 },
  { name: '아모스', abbr: '암', chapters: 9 },
  { name: '오바댜', abbr: '옵', chapters: 1 },
  { name: '요나', abbr: '욘', chapters: 4 },
  { name: '미가', abbr: '믹', chapters: 7 },
  { name: '나훔', abbr: '나', chapters: 3 },
  { name: '하박국', abbr: '합', chapters: 3 },
  { name: '스바냐', abbr: '습', chapters: 3 },
  { name: '학개', abbr: '학', chapters: 2 },
  { name: '스가랴', abbr: '슥', chapters: 14 },
  { name: '말라기', abbr: '말', chapters: 4 },
 
  // 신약성경 (27권)
  { name: '마태복음', abbr: '마', chapters: 28 },
  { name: '마가복음', abbr: '막', chapters: 16 },
  { name: '누가복음', abbr: '눅', chapters: 24 },
  { name: '요한복음', abbr: '요', chapters: 21 },
  { name: '사도행전', abbr: '행', chapters: 28 },
  { name: '로마서', abbr: '롬', chapters: 16 },
  { name: '고린도전서', abbr: '고전', chapters: 16 },
  { name: '고린도후서', abbr: '고후', chapters: 13 },
  { name: '갈라디아서', abbr: '갈', chapters: 6 },
  { name: '에베소서', abbr: '엡', chapters: 6 },
  { name: '빌립보서', abbr: '빌', chapters: 4 },
  { name: '골로새서', abbr: '골', chapters: 4 },
  { name: '데살로니가전서', abbr: '살전', chapters: 5 },
  { name: '데살로니가후서', abbr: '살후', chapters: 3 },
  { name: '디모데전서', abbr: '딤전', chapters: 6 },
  { name: '디모데후서', abbr: '딤후', chapters: 4 },
  { name: '디도서', abbr: '딛', chapters: 3 },
  { name: '빌레몬서', abbr: '몬', chapters: 1 },
  { name: '히브리서', abbr: '히', chapters: 13 },
  { name: '야고보서', abbr: '약', chapters: 5 },
  { name: '베드로전서', abbr: '벧전', chapters: 5 },
  { name: '베드로후서', abbr: '벧후', chapters: 3 },
  { name: '요한일서', abbr: '요일', chapters: 5 },
  { name: '요한이서', abbr: '요이', chapters: 1 },
  { name: '요한삼서', abbr: '요삼', chapters: 1 },
  { name: '유다서', abbr: '유', chapters: 1 },
  { name: '요한계시록', abbr: '계', chapters: 22 }
];

  // 통독 코스 리스트
  public COURSE_LIST = [
    { id: 'all-1year', name: '성경 전체 1년 통독', description: '성경 전체를 1년 동안 완독하는 기본 코스입니다.', range: 'all', durationDays: 365, totalChapters: 1189 },
    { id: 'all-6month', name: '성경 전체 6개월 통독', description: '성경 전체를 6개월 동안 빠르게 집중하여 통독합니다.', range: 'all', durationDays: 180, totalChapters: 1189 },
    { id: 'all-3month', name: '성경 전체 3개월 통독', description: '하루에 많은 분량을 읽으며 3개월 만에 전체를 통독합니다.', range: 'all', durationDays: 90, totalChapters: 1189 },
    { id: 'ot-1year', name: '구약 1년 통독', description: '구약 성경만을 1년 동안 깊이 있게 통독합니다.', range: 'ot', durationDays: 365, totalChapters: 929 },
    { id: 'ot-6month', name: '구약 6개월 통독', description: '구약 성경을 6개월 동안 통독합니다.', range: 'ot', durationDays: 180, totalChapters: 929 },
    { id: 'ot-3month', name: '구약 3개월 통독', description: '구약 성경을 3개월 동안 빠르게 통독합니다.', range: 'ot', durationDays: 90, totalChapters: 929 },
    { id: 'nt-1year', name: '신약 1년 통독', description: '신약 성경만을 1년 동안 매일 조금씩 묵상하며 읽습니다.', range: 'nt', durationDays: 365, totalChapters: 260 },
    { id: 'nt-6month', name: '신약 6개월 통독', description: '신약 성경을 6개월 동안 통독합니다.', range: 'nt', durationDays: 180, totalChapters: 260 },
    { id: 'nt-3month', name: '신약 3개월 통독', description: '신약 성경을 3개월 동안 통독합니다.', range: 'nt', durationDays: 90, totalChapters: 260 }
  ];

  constructor(private http: HttpClient, private firestore: Firestore) {}

  getVerses(abbr: string, chapter: number) {
    if (!this.bibleData) return [];
    const prefix = `${abbr}${chapter}:`;
    return Object.keys(this.bibleData)
      .filter(k => k.startsWith(prefix))
      .sort((a, b) => {
        const aNum = parseInt(a.split(':')[1]);
        const bNum = parseInt(b.split(':')[1]);
        return aNum - bNum;
      })
      .map(k => ({ v: k.split(':')[1], text: this.bibleData[k] }));
  }

  // JSON 파일 로드
  async getBibleData() {
    if (!this.bibleData) {
      this.bibleData = await firstValueFrom(this.http.get('assets/bible-data.json'));
    }
    return this.bibleData;
  }

  // 특정 장 읽기 완료 기록
  async saveReadRecord(nickname: string, abbr: string, chapter: number) {
    const userRef = doc(this.firestore, `users/${nickname}`);
    const readDocRef = doc(this.firestore, `user_reads/${nickname}`);

    if (abbr) {
      // 랭킹용 데이터 업데이트
      await updateDoc(userRef, {
        totalRead: increment(1),
        lastReadAt: new Date()
      });
      // 상세 읽기 기록 추가
      await setDoc(readDocRef, { reads: arrayUnion(`${abbr}${chapter}`) }, { merge: true });
    }
  }

  async getUserReads(nickname: string): Promise<string[]> {
    const docRef = doc(this.firestore, `user_reads/${nickname}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data()['reads'] || [];
    }
    return [];
  }

  // --- 통독 코스 관련 Firestore 연동 API ---

  // 통독 코스 신청
  async enrollInCourse(nickname: string, courseId: string, startDateStr: string) {
    const enrollRef = doc(this.firestore, `user_course_enrollments/${nickname}`);
    await setDoc(enrollRef, {
      nickname,
      courseId,
      startDate: startDateStr,
      completedDates: []
    });
  }

  // 신청 현황 가져오기
  async getEnrollment(nickname: string) {
    const enrollRef = doc(this.firestore, `user_course_enrollments/${nickname}`);
    const snap = await getDoc(enrollRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  }

  // 특정 날짜(포맷: YYYY-MM-DD) 완료 토글/추가
  async saveCourseCompleteDate(nickname: string, dateStr: string, isComplete: boolean) {
    const enrollRef = doc(this.firestore, `user_course_enrollments/${nickname}`);
    const snap = await getDoc(enrollRef);
    if (snap.exists()) {
      const data = snap.data();
      let completedDates: string[] = data['completedDates'] || [];
      if (isComplete) {
        if (!completedDates.includes(dateStr)) {
          completedDates.push(dateStr);
        }
      } else {
        completedDates = completedDates.filter(d => d !== dateStr);
      }
      await updateDoc(enrollRef, { completedDates });
    }
  }

  // 통독 코스 취소/삭제 (재설정용)
  async deleteEnrollment(nickname: string) {
    const enrollRef = doc(this.firestore, `user_course_enrollments/${nickname}`);
    await setDoc(enrollRef, {});
  }

  // 통독 계획 일자별 데이터 계산기
  generateCoursePlan(courseId: string, startDateStr: string): any[] {
    const course = this.COURSE_LIST.find(c => c.id === courseId);
    if (!course) return [];

    // 1. 대상 성경 필터링
    let filteredBooks: any[] = [];
    if (course.range === 'all') {
      filteredBooks = this.BIBLE_LIST;
    } else if (course.range === 'ot') {
      filteredBooks = this.BIBLE_LIST.slice(0, 39);
    } else if (course.range === 'nt') {
      filteredBooks = this.BIBLE_LIST.slice(39);
    }

    // 2. 전체 장(Chapter) 리스트 구성
    const allChapters: { bookName: string, abbr: string, ch: number }[] = [];
    filteredBooks.forEach(b => {
      for (let i = 1; i <= b.chapters; i++) {
        allChapters.push({ bookName: b.name, abbr: b.abbr, ch: i });
      }
    });

    const totalChapters = allChapters.length;
    const duration = course.durationDays;
    const plan: any[] = [];
    const startDate = new Date(startDateStr);

    // 3. 각 날짜별 분배 알고리즘
    for (let day = 1; day <= duration; day++) {
      const startIdx = Math.floor(((day - 1) * totalChapters) / duration);
      const endIdx = Math.floor((day * totalChapters) / duration);

      const items = allChapters.slice(startIdx, endIdx);
      
      // 날짜 계산
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + (day - 1));
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dateVal = String(targetDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dateVal}`;

      let rangeText = '';
      if (items.length > 0) {
        const first = items[0];
        const last = items[items.length - 1];
        if (first.bookName === last.bookName) {
          if (first.ch === last.ch) {
            rangeText = `${first.bookName} ${first.ch}장`;
          } else {
            rangeText = `${first.bookName} ${first.ch}장 ~ ${last.ch}장`;
          }
        } else {
          rangeText = `${first.bookName} ${first.ch}장 ~ ${last.bookName} ${last.ch}장`;
        }
      }

      plan.push({
        day,
        dateStr,
        rangeText,
        chapters: items,
        totalChapters: items.length
      });
    }

    return plan;
  }
}
