import { Component, OnInit } from '@angular/core';
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { BibleService } from './bible.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
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

  constructor(private firestore: Firestore, public bibleService: BibleService) {
    this.bibleList = this.bibleService.BIBLE_LIST;
  }

   ngOnInit() {
    // 자동 로그인 체크: 로컬스토리지에 저장된 유저 정보가 있는지 확인
    const savedUser = localStorage.getItem('gochon_user');
    if (savedUser) {
      this.user = JSON.parse(savedUser);
      this.loadInitialData();
    }
  }

  async loadInitialData() {
    await this.bibleService.getBibleData();
    this.onBookChange();
    this.loadRanking();
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

  async markAsRead() {
    const book = this.bibleList[this.selectedBookIndex];
    await this.bibleService.saveReadRecord(this.user.nickname, book.abbr, this.selectedChapter);
    alert(`${book.name} ${this.selectedChapter}장 완료!`);
    this.loadRanking();
  }

  // 랭킹 로드
  async loadRanking() {
    const q = query(collection(this.firestore, 'users'), orderBy('totalRead', 'desc'), limit(50));
    const snap = await getDocs(q);
    this.ranking = snap.docs.map(d => d.data());
  }
}
