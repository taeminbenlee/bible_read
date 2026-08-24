import { Component, OnInit } from '@angular/core';
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { BibleService } from './bible.service';
import { HostListener } from '@angular/core'; // 상단에 추가
import { SwUpdate } from '@angular/service-worker';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  deferredPrompt: any;
  showInstallBtn = false;
  user: any = null; //
  nickname = '';
  password = '';
  churchCode = '';
  isSignUpMode = false;
  activeTab = 'read';

  // 성경 데이터 관련 변수 (기존과 동일)
  bibleList: any[] = [];
  selectedBookIndex = 0;
  selectedChapter = 1;
  chapters: number[] = [];
  verses: any[] = [];
  ranking: any[] = [];

  readChapters: string[] = []; // 이미 읽은 장들의 ID (예: ['창1', '창2'])

  // --- 통독 관련 변수 ---
  courseList: any[] = [];
  selectedCourseId = '';
  courseStartDate = '';
  enrollment: any = null;
  coursePlan: any[] = [];

  // 날짜별 통독 일정 목록 페이징 및 달 계산용
  currentYearMonth = ''; // 'YYYY-MM'
  filteredPlan: any[] = [];

  constructor(private firestore: Firestore, public bibleService: BibleService, private swUpdate: SwUpdate) {
    this.bibleList = this.bibleService.BIBLE_LIST;
    this.courseList = this.bibleService.COURSE_LIST;
  }

   ngOnInit() {
    // 자동 로그인 체크: 로컬스토리지에 저장된 유저 정보가 있는지 확인
    const savedUser = localStorage.getItem('gochon_user');
    if (savedUser) {
      this.user = JSON.parse(savedUser);
      this.loadInitialData();
    }
    this.checkiOSInstallationButton();

    // 서비스 워커가 업데이트를 감지했을 때 실행
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe(evt => {
        switch (evt.type) {
          case 'VERSION_READY':
            // 새 버전이 준비되면 사용자에게 묻거나 즉시 새로고침
            if (confirm('새로운 업데이트가 있습니다. 적용하시겠습니까?')) {
              window.location.reload();
            }
            break;
        }
      });
    }
  }

  checkiOSInstallationButton() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS && !isStandalone) {
      this.showInstallBtn = true;
    }
  }

  async loadInitialData() {
    // 시작일 초기값 설정 (오늘 기준)
    const today = new Date();
    this.courseStartDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    await this.bibleService.getBibleData();
    await this.updateReadList();
    this.onBookChange();
    this.loadRanking();
    await this.loadEnrollment();
  }

  async updateReadList() {
    this.readChapters = await this.bibleService.getUserReads(this.user.nickname);
  }

  // --- 통독 관련 메소드 ---
  async loadEnrollment() {
    if (!this.user) return;
    this.enrollment = await this.bibleService.getEnrollment(this.user.nickname);
    if (this.enrollment && this.enrollment.courseId) {
      this.coursePlan = this.bibleService.generateCoursePlan(this.enrollment.courseId, this.enrollment.startDate);
      
      // 통독 계획 일정이 있다면 기본적으로 활성 달을 시작달로 맞춰줌
      if (this.coursePlan.length > 0) {
        const firstPlanMonth = this.coursePlan[0].dateStr.substring(0, 7);
        // 오늘 날짜의 달이 계획 기간에 포함된다면 오늘 달로 맞추고 없으면 첫 달로
        const todayStr = this.getTodayDateStr();
        const todayMonth = todayStr.substring(0, 7);
        const hasTodayMonth = this.coursePlan.some(p => p.dateStr.startsWith(todayMonth));
        this.currentYearMonth = hasTodayMonth ? todayMonth : firstPlanMonth;
      }
      this.filterPlanByMonth();
    } else {
      this.coursePlan = [];
      this.filteredPlan = [];
    }
  }

  async startCourse() {
    if (!this.selectedCourseId) return alert('통독 코스를 선택하세요.');
    if (!this.courseStartDate) return alert('시작일을 입력하세요.');

    if (confirm('선택하신 코스로 성경 통독을 시작하시겠습니까?')) {
      await this.bibleService.enrollInCourse(this.user.nickname, this.selectedCourseId, this.courseStartDate);
      alert('통독 코스가 성공적으로 등록되었습니다!');
      await this.loadEnrollment();
    }
  }

  async cancelCourse() {
    if (confirm('정말로 현재 진행 중인 통독 코스를 중단하시겠습니까? 기존 통독 일정 완료 정보가 초기화됩니다. (성경 개별 읽기 기록은 유지됩니다)')) {
      await this.bibleService.deleteEnrollment(this.user.nickname);
      this.enrollment = null;
      this.coursePlan = [];
      this.filteredPlan = [];
      alert('통독 코스가 중단되었습니다.');
    }
  }

  // 오늘 날짜 문자열 획득 (KST 기준 YYYY-MM-DD)
  getTodayDateStr(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dateVal}`;
  }

  // 오늘 통독 일정 가져오기
  getTodayPlan(): any {
    const todayStr = this.getTodayDateStr();
    return this.coursePlan.find(p => p.dateStr === todayStr);
  }

  // 어제 통독 일정 가져오기
  getYesterdayPlan(): any {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterdayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return this.coursePlan.find(p => p.dateStr === yesterdayStr);
  }

  // 특정 일자의 통독 완료 여부 검사
  isDayCompleted(dateStr: string): boolean {
    if (!this.enrollment || !this.enrollment.completedDates) return false;
    return this.enrollment.completedDates.includes(dateStr);
  }

  // 특정 일자 통독 완료 처리
  async toggleDayComplete(dateStr: string, isComplete: boolean) {
    await this.bibleService.saveCourseCompleteDate(this.user.nickname, dateStr, isComplete);
    await this.loadEnrollment();
  }

  // 특정 일자 읽기 범위 통독 시작 (읽기 본문 탭으로 자동 이동)
  startReadingCourseRange(planItem: any) {
    if (!planItem || planItem.chapters.length === 0) return;
    const firstChapter = planItem.chapters[0];
    
    // BIBLE_LIST에서 abbr에 일치하는 index 조회
    const bookIndex = this.bibleList.findIndex(b => b.abbr === firstChapter.abbr);
    if (bookIndex !== -1) {
      this.selectedBookIndex = bookIndex;
      this.onBookChange();
      this.selectChapter(firstChapter.ch);
      this.activeTab = 'read';
    }
  }

  // 특정 연월(YYYY-MM) 기준으로 필터링
  filterPlanByMonth() {
    this.filteredPlan = this.coursePlan.filter(p => p.dateStr.startsWith(this.currentYearMonth));
  }

  // 통독 달 이동 (이전/다음)
  prevMonth() {
    const [year, month] = this.currentYearMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    this.currentYearMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    this.filterPlanByMonth();
  }

  nextMonth() {
    const [year, month] = this.currentYearMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    this.currentYearMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    this.filterPlanByMonth();
  }

  // 코스 기준 읽은 장 수 계산 (사용자가 실제 읽은 성경 장 중 통독 대상 범위에 해당하는 장 수)
  getCourseReadChaptersCount(): number {
    if (!this.enrollment) return 0;
    const course = this.courseList.find(c => c.id === this.enrollment.courseId);
    if (!course) return 0;

    let targetAbbrs: string[] = [];
    if (course.range === 'all') {
      targetAbbrs = this.bibleList.map(b => b.abbr);
    } else if (course.range === 'ot') {
      targetAbbrs = this.bibleList.slice(0, 39).map(b => b.abbr);
    } else if (course.range === 'nt') {
      targetAbbrs = this.bibleList.slice(39).map(b => b.abbr);
    }

    return this.readChapters.filter(key => {
      // key는 '창1', '살후3' 등. 앞쪽 한글 약어를 파싱
      const match = key.match(/^([^\d]+)/);
      if (match) {
        return targetAbbrs.includes(match[1]);
      }
      return false;
    }).length;
  }

  // [로그인]
  async login() {
    if (!this.nickname || !this.password) return alert('닉네임과 비밀번호를 입력하세요.');

    const userRef = doc(this.firestore, `users/${this.nickname}`);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData['password'] === this.password) {
        this.user = userData;
        localStorage.setItem('gochon_user', JSON.stringify(userData)); // 로그인 유지
        this.loadInitialData();
      } else {
        alert('비밀번호가 틀렸습니다.');
      }
    } else {
      alert('존재하지 않는 닉네임입니다.');
    }
  }

  // [회원가입]
  async signUp() {
    if (this.nickname.length > 10) return alert('닉네임은 최대 10자입니다.');
    if (this.churchCode !== '고촌청년') return alert('인증코드가 틀렸습니다.');

    const userRef = doc(this.firestore, `users/${this.nickname}`);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) return alert('이미 존재하는 닉네임입니다.');

    const newUser = {
      nickname: this.nickname,
      password: this.password,
      totalRead: 0,
      createdAt: new Date()
    };

    try {
      await setDoc(userRef, newUser);
      await setDoc(doc(this.firestore, `user_reads/${this.nickname}`), { reads: [] });

      this.user = newUser;
      localStorage.setItem('gochon_user', JSON.stringify(newUser));
      this.loadInitialData();
      alert('가입을 환영합니다!');
    } catch (e) {
      alert('가입 중 오류 발생');
    }
  }

  logout() {
    this.user = null;
    localStorage.removeItem('gochon_user');
  }

  // 성경 로직
  onBookChange() {
    const book = this.bibleList[this.selectedBookIndex];
    this.chapters = Array.from({length: book.chapters}, (_, i) => i + 1);
    this.verses = [];
  }

  selectChapter(ch: number) {
    this.selectedChapter = ch;
    const book = this.bibleList[this.selectedBookIndex];
    this.verses = this.bibleService.getVerses(book.abbr, ch);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }


  // 랭킹 로드
  async loadRanking() {
    const q = query(collection(this.firestore, 'users'), orderBy('totalRead', 'desc'), limit(50));
    const snap = await getDocs(q);
    this.ranking = snap.docs.map(d => d.data());
  }

  isRead(chapter: number): boolean {
    const book = this.bibleList[this.selectedBookIndex];
    const key = `${book.abbr}${chapter}`;
    return this.readChapters.includes(key);
  }

  // 5. markAsRead 함수 수정 (읽자마자 화면에 반영)
  async markAsRead() {
    const book = this.bibleList[this.selectedBookIndex];
    await this.bibleService.saveReadRecord(this.user.nickname, book.abbr, this.selectedChapter);

    // 현재 읽은 장을 목록에 즉시 추가하여 화면 갱신
    const key = `${book.abbr}${this.selectedChapter}`;
    if (!this.readChapters.includes(key)) {
      this.readChapters.push(key);
    }

    alert(`${book.name} ${this.selectedChapter}장 완료!`);
    this.loadRanking();
  }

  getBookProgress() {
    const book = this.bibleList[this.selectedBookIndex];
    if (!book) return { read: 0, total: 0, percent: 0 };

    let readInBook = 0;
    for (let i = 1; i <= book.chapters; i++) {
      if (this.readChapters.includes(`${book.abbr}${i}`)) {
        readInBook++;
      }
    }

    return {
      read: readInBook,
      total: book.chapters,
      percent: Math.round((readInBook / book.chapters) * 100)
    };
  }

  // 2. 성경 전체 진행 상태 계산
  getTotalProgressPercent(): number {
    // 성경 전체 장수는 1,189장입니다.
    const totalChapters = 1189;
    const readCount = this.readChapters.length;
    return parseFloat(((readCount / totalChapters) * 100).toFixed(1));
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(e: any) {
    // 안드로이드/크롬에서 설치 팝업을 띄울 수 있는 상태가 되면 발생
    e.preventDefault();
    this.deferredPrompt = e;
    this.showInstallBtn = true;
  }

  async installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.showInstallBtn = false;
      }
      this.deferredPrompt = null;
    } else {
      // 아이폰이나 설치 팝업이 안 뜨는 경우 안내
      alert('아이폰(사파리): 하단 공유 버튼 클릭 후 [홈 화면에 추가]를 눌러주세요!\n안드로이드: 브라우저 설정 메뉴에서 [앱 설치]를 눌러주세요.');
    }
  }
}
