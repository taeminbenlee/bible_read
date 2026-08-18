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


  constructor(private firestore: Firestore, public bibleService: BibleService, private swUpdate: SwUpdate) {
    this.bibleList = this.bibleService.BIBLE_LIST;
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
    await this.bibleService.getBibleData();
    await this.updateReadList();
    this.onBookChange();
    this.loadRanking();
  }

  async updateReadList() {
    this.readChapters = await this.bibleService.getUserReads(this.user.nickname);
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
