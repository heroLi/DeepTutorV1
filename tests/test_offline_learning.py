"""Offline regression tests: python -m unittest discover -s tests -p test_offline_learning.py -v"""
import os
import tempfile
import unittest
from unittest.mock import patch

# Never touch family records. All values below are synthetic.
os.environ['TUTOR_DATA_DIR'] = tempfile.mkdtemp(prefix='tutor-offline-test-')
from fastapi.testclient import TestClient
import app as service
from core import demo_plan


class OfflineLearningTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(service.app)
        with service.db() as c:
            c.execute('DELETE FROM attempts')
            c.execute('DELETE FROM lessons')

    def create(self):
        r = self.client.post('/api/lessons', json={'mode':'demo','learner':'sister','total':12,'groups':3})
        self.assertEqual(r.status_code, 200)
        return r.json()

    def confirm(self, item, **kwargs):
        body = {'learner':'sister','plan':item['plan'],'reviewed':True}
        body.update(kwargs)
        return self.client.post(f"/api/lessons/{item['id']}/study", json=body)

    def test_offline_learning_practice_review_without_external_work(self):
        with patch('core.chat', side_effect=AssertionError('No model calls')), patch.object(service.POOL, 'submit', side_effect=AssertionError('No render work')):
            item = self.create()
            r = self.confirm(item)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()['state'], 'offline_ready')
            answer_url = f"/api/lessons/{item['id']}/answer"
            self.assertFalse(self.client.post(answer_url, json={'learner':'sister','answer':'4'}).json()['correct'])
            self.assertTrue(self.client.post(answer_url, json={'learner':'sister','answer':'５'}).json()['correct'])
            memory = self.client.get('/api/memory?learner=sister').json()
            self.assertEqual(memory['profile']['attempts'], 2)
            self.assertEqual(memory['summaries'][0]['independent_days'], 0)
            self.assertEqual(self.client.get('/api/memory?learner=little_sister').json()['profile']['attempts'], 0)

    def test_confirmation_required_and_draft_cannot_answer(self):
        item = self.create()
        self.assertEqual(self.confirm(item, reviewed=False).status_code, 422)
        self.assertEqual(self.client.post(f"/api/lessons/{item['id']}/answer", json={'learner':'sister','answer':'5'}).status_code, 409)

    def test_repeat_and_cross_profile_do_not_change_lesson(self):
        item = self.create()
        self.assertEqual(self.confirm(item, learner='little_sister').status_code, 404)
        self.assertEqual(self.confirm(item).status_code, 200)
        changed = demo_plan(18,3).model_dump()
        self.assertEqual(self.confirm(item, plan=changed).status_code, 409)
        self.assertEqual(self.client.get(f"/api/lessons/{item['id']}?learner=sister").json()['plan'], item['plan'])

    def test_validation_and_local_boundary(self):
        item = self.create()
        bad = dict(item['plan'], scenes=[])
        self.assertEqual(self.confirm(item, plan=bad).status_code, 422)
        self.assertEqual(self.client.post(f"/api/lessons/{item['id']}/study", json={'learner':'sister','plan':item['plan'],'reviewed':True}, headers={'Origin':'https://evil.invalid'}).status_code, 403)
        for total,groups in [(13,3),(2,3),(49,7),(12,9)]:
            self.assertEqual(self.client.post('/api/lessons',json={'total':total,'groups':groups}).status_code,422)

    def test_no_media_claim_and_delete_removes_records(self):
        item = self.create(); self.confirm(item)
        self.assertEqual(self.client.get(f"/api/lessons/{item['id']}/files/lesson.mp4?learner=sister").status_code,404)
        self.client.post(f"/api/lessons/{item['id']}/answer",json={'learner':'sister','answer':'5'})
        self.assertEqual(self.client.delete(f"/api/lessons/{item['id']}?learner=sister").status_code,200)
        self.assertEqual(self.client.get('/api/memory?learner=sister').json()['profile']['attempts'],0)

    def test_video_route_preserved_and_cannot_be_overwritten(self):
        item = self.create()
        with patch.object(service.POOL,'submit') as submit:
            body={'learner':'sister','plan':item['plan'],'reviewed':True}
            self.assertEqual(self.client.post(f"/api/lessons/{item['id']}/render",json=body).status_code,200)
            submit.assert_called_once()
            self.assertEqual(self.confirm(item).status_code,409)
            self.assertEqual(self.client.post(f"/api/lessons/{item['id']}/render",json=body).status_code,409)
        service.SLOTS.release()
        with service.db() as c:
            c.execute("UPDATE lessons SET state='ready' WHERE id=?",(item['id'],))
        self.assertEqual(self.client.post(f"/api/lessons/{item['id']}/answer",json={'learner':'sister','answer':'5'}).status_code,200)

    def test_every_supported_rule_example(self):
        count=0
        for total in range(2,49):
            for groups in range(2,9):
                if total>=groups and total%groups==0:
                    plan=demo_plan(total,groups)
                    self.assertEqual(int(plan.answer)*groups,total)
                    self.assertEqual(int(plan.quiz.answer)*groups,total+groups)
                    count+=1
        self.assertEqual(count,81)


if __name__ == '__main__':
    unittest.main()
